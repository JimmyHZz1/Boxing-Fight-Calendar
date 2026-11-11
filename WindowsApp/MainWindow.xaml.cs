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

    private void MenuButton_Click(object sender, RoutedEventArgs e)
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
        Add("Back", () => { if (CalendarBrowser.CanGoBack) CalendarBrowser.GoBack(); });
        Add("Forward", () => { if (CalendarBrowser.CanGoForward) CalendarBrowser.GoForward(); });
        menu.Items.Add(new System.Windows.Controls.Separator());
        Add("Home", () => CalendarBrowser.Source = HomeUri);
        Add("Refresh page", () => CalendarBrowser.Reload());
        Add("Data Health Centre", () => _ = CalendarBrowser.ExecuteScriptAsync("window.DataHealthCentre?.open?.()"));
        Add("Notifications", () => _ = CalendarBrowser.ExecuteScriptAsync("document.getElementById('notification-bell')?.click()"));
        Add("Search", () => _ = CalendarBrowser.ExecuteScriptAsync("document.getElementById('global-search-open')?.click()"));
        menu.Items.Add(new System.Windows.Controls.Separator());
        var startup = new System.Windows.Controls.MenuItem { Header = "Launch on Windows startup", IsCheckable = true, IsChecked = _startupEnabled };
        startup.Click += (_, _) => UpdateStartupSetting(startup.IsChecked);
        menu.Items.Add(startup);
        menu.IsOpen = true;
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
            try { await CalendarBrowser.ExecuteScriptAsync("document.body.classList.add('desktop-shell')"); }
            catch { }
        }
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var message = JsonDocument.Parse(e.WebMessageAsJson);
            if (!message.RootElement.TryGetProperty("type", out var type) || type.GetString() != "notification-preferences" ||
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