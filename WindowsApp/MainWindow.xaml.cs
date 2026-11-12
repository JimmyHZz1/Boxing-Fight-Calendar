using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;

namespace SportsGamesCalendar;

public partial class MainWindow : Window
{
    private static readonly Uri HomeUri =
        new("https://jimmyhzz1.github.io/Boxing-Fight-Calendar/");
    private const string StartupRunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string StartupValueName = "SportsGamesCalendar";
    private bool _browserReady;
    private bool _startupEnabled;
    private bool _canGoBack;
    private bool _canGoForward;

    public MainWindow()
    {
        InitializeComponent();
        LoadStartupSetting();
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        StateChanged += (_, _) => UpdateWindowStateGlyph();
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (System.Windows.Application.Current is App app && !app.AllowExit)
        {
            e.Cancel = true;
            Hide();
        }
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;
        if (e.ClickCount == 2) ToggleMaximise();
        else DragMove();
    }

    private void UpdateWindowStateGlyph() => MaximiseButton.Content = WindowState == WindowState.Maximized ? "\uE923" : "\uE922";

    private void MinimiseButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void MaximiseButton_Click(object sender, RoutedEventArgs e) => ToggleMaximise();
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Close();
    private void ToggleMaximise() => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;

    private void LoadStartupSetting()
    {
        try
        {
            using var runKey = Registry.CurrentUser.OpenSubKey(StartupRunKey, writable: false);
            _startupEnabled = runKey?.GetValue(StartupValueName) is string;
        }
        catch { _startupEnabled = false; }
    }

    private async void MenuButton_Click(object sender, RoutedEventArgs e)
    {
        var menu = new System.Windows.Controls.ContextMenu
        {
            PlacementTarget = MenuButton,
            Placement = System.Windows.Controls.Primitives.PlacementMode.Bottom
        };
        void Add(string label, Action action)
        {
            var item = new System.Windows.Controls.MenuItem { Header = label, IsEnabled = _browserReady };
            item.Click += (_, _) => action();
            menu.Items.Add(item);
        }
        Add("Back", () => _ = CalendarBrowser.ExecuteScriptAsync("window.history.back()"));
        Add("Forward", () => _ = CalendarBrowser.ExecuteScriptAsync("window.history.forward()"));
        menu.Items.Add(new System.Windows.Controls.Separator());
        Add("Home", () => _ = CalendarBrowser.ExecuteScriptAsync("window.showScreen?.('hub-selection-screen')"));
        Add("Refresh page", () => CalendarBrowser.Reload());

        var startupMenu = new System.Windows.Controls.MenuItem { Header = "Open on startup", IsEnabled = _browserReady };
        var currentDestination = "hub-selection-screen";
        if (_browserReady)
        {
            try
            {
                var result = await CalendarBrowser.ExecuteScriptAsync("window.getHubStartupDestination?.() || 'hub-selection-screen'");
                currentDestination = JsonSerializer.Deserialize<string>(result) ?? currentDestination;
            }
            catch { }
        }
        var destinations = new (string Label, string Value)[]
        {
            ("Hub Selection Screen", "hub-selection-screen"),
            ("Sports Hub", "home-screen"),
            ("Games Hub", "games-calendar-screen"),
            ("SWGOH Hub", "swgoh-hub-screen")
        };
        foreach (var destination in destinations)
        {
            var item = new System.Windows.Controls.MenuItem
            {
                Header = destination.Label,
                IsCheckable = true,
                IsChecked = currentDestination == destination.Value
            };
            item.Click += (_, _) =>
            {
                foreach (System.Windows.Controls.MenuItem option in startupMenu.Items)
                    option.IsChecked = ReferenceEquals(option, item);
                _ = CalendarBrowser.ExecuteScriptAsync($"window.setHubStartupDestination?.('{destination.Value}')");
            };
            startupMenu.Items.Add(item);
        }
        menu.Items.Add(startupMenu);
        Add("Data Health Centre", () => _ = CalendarBrowser.ExecuteScriptAsync("window.DataHealthCentre?.open?.()"));
        Add("Notifications", () => _ = CalendarBrowser.ExecuteScriptAsync("document.getElementById('notification-bell')?.click()"));
        Add("Search", () => _ = CalendarBrowser.ExecuteScriptAsync("document.getElementById('global-search-open')?.click()"));
        menu.Items.Add(new System.Windows.Controls.Separator());
        var startup = new System.Windows.Controls.MenuItem { Header = "Launch on Windows startup", IsCheckable = true, IsChecked = _startupEnabled };
        startup.Click += (_, _) => UpdateStartupSetting(startup.IsChecked);
        menu.Items.Add(startup);
        menu.IsOpen = true;
    }

    private async void BackButton_Click(object sender, RoutedEventArgs e)
    {
        if (_browserReady && _canGoBack) await CalendarBrowser.ExecuteScriptAsync("window.history.back()");
    }

    private async void ForwardButton_Click(object sender, RoutedEventArgs e)
    {
        if (_browserReady && _canGoForward) await CalendarBrowser.ExecuteScriptAsync("window.history.forward()");
    }

    private async void HomeButton_Click(object sender, RoutedEventArgs e)
    {
        if (_browserReady) await CalendarBrowser.ExecuteScriptAsync("window.showScreen?.('hub-selection-screen')");
    }

    private void UpdateNavigationButtons()
    {
        BackButton.IsEnabled = _browserReady && _canGoBack;
        ForwardButton.IsEnabled = _browserReady && _canGoForward;
    }

    private void UpdateStartupSetting(bool enabled)
    {
        try
        {
            using var runKey = Registry.CurrentUser.CreateSubKey(StartupRunKey, writable: true);
            if (enabled)
            {
                var executablePath = Environment.ProcessPath;
                if (string.IsNullOrWhiteSpace(executablePath))
                    throw new InvalidOperationException("Windows could not determine the application path.");
                runKey.SetValue(StartupValueName, "\"" + executablePath + "\" --startup");
            }
            else runKey.DeleteValue(StartupValueName, throwOnMissingValue: false);
            _startupEnabled = enabled;
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show($"Windows couldn't update the startup setting.\n\n{ex.Message}",
                "Startup setting unavailable", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
        }
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        ConnectionLabel.Text = "Starting browser…";
        try
        {
            var runtimeVersion = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (string.IsNullOrWhiteSpace(runtimeVersion))
                throw new InvalidOperationException("The Microsoft Edge WebView2 Runtime is not installed.");
            await CalendarBrowser.EnsureCoreWebView2Async();
            CalendarBrowser.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
            CalendarBrowser.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;
            CalendarBrowser.CoreWebView2.NewWindowRequested += CoreWebView2_NewWindowRequested;
            CalendarBrowser.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
            CalendarBrowser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            CalendarBrowser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _browserReady = true;
            UpdateNavigationButtons();
            CalendarBrowser.Source = HomeUri;
            ConnectionLabel.Text = "Loading calendar…";
        }
        catch (Exception ex)
        {
            ConnectionLabel.Text = "Browser setup required";
            var result = System.Windows.MessageBox.Show(
                "The Microsoft Edge WebView2 Runtime is required to run this application.\n\n" +
                "Would you like to open Microsoft's official download page?\n\n" + $"Details: {ex.Message}",
                "WebView2 Runtime required", System.Windows.MessageBoxButton.YesNo, System.Windows.MessageBoxImage.Information);
            if (result == System.Windows.MessageBoxResult.Yes) OpenExternal("https://developer.microsoft.com/microsoft-edge/webview2/");
        }
    }

    private void CoreWebView2_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var target)) { e.Cancel = true; return; }
        if (!IsCalendarHost(target)) { e.Cancel = true; OpenExternal(target.AbsoluteUri); return; }
        ConnectionLabel.Text = "Loading calendar…";
    }

    private async void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        ConnectionLabel.Text = e.IsSuccess ? "Connected" : "Connection problem";
        if (e.IsSuccess && _browserReady)
        {
            try
            {
                await CalendarBrowser.ExecuteScriptAsync("document.body.classList.add('desktop-shell'); window.__hubReportNavigationState?.()");
            }
            catch { }
        }
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var message = JsonDocument.Parse(e.WebMessageAsJson);
            if (!message.RootElement.TryGetProperty("type", out var type)) return;
            var messageType = type.GetString();
            if (messageType == "navigation-state")
            {
                _canGoBack = message.RootElement.TryGetProperty("canGoBack", out var back) && back.GetBoolean();
                _canGoForward = message.RootElement.TryGetProperty("canGoForward", out var forward) && forward.GetBoolean();
                Dispatcher.Invoke(UpdateNavigationButtons);
                return;
            }
            if (messageType == "notification-test")
            {
                var success = System.Windows.Application.Current is App app && app.SendTestNotification();
                var result = new
                {
                    type = "notification-test-result",
                    success,
                    message = success
                        ? "Windows accepted the test notification request. Check your notification area."
                        : "The Windows notification service is not available."
                };
                CalendarBrowser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(result));
                return;
            }
            if (messageType != "notification-preferences" ||
                !message.RootElement.TryGetProperty("preferences", out var preferences)) return;
            var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SportsGamesCalendar");
            Directory.CreateDirectory(directory);
            File.WriteAllText(Path.Combine(directory, "notification-preferences.json"), preferences.GetRawText());
        }
        catch { }
    }

    private void CoreWebView2_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var target)) OpenExternal(target.AbsoluteUri);
    }

    private static bool IsCalendarHost(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps && uri.Host.Equals(HomeUri.Host, StringComparison.OrdinalIgnoreCase);

    private static void OpenExternal(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show($"Windows couldn't open this link.\n\n{ex.Message}",
                "Unable to open link", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
        }
    }
}