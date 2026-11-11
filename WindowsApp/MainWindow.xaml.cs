using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
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
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (System.Windows.Application.Current is App app && !app.AllowExit)
        {
            e.Cancel = true;
            Hide();
        }
    }

    private void LoadStartupSetting()
    {
        try
        {
            using var runKey = Registry.CurrentUser.OpenSubKey(StartupRunKey, writable: false);
            _startupEnabled = runKey?.GetValue(StartupValueName) is string;
        }
        catch
        {
            _startupEnabled = false;
        }
    }

    private void MenuButton_Click(object sender, RoutedEventArgs e)
    {
        var menu = new System.Windows.Controls.ContextMenu
        {
            PlacementTarget = MenuButton,
            Placement = System.Windows.Controls.Primitives.PlacementMode.Bottom
        };

        var back = new System.Windows.Controls.MenuItem { Header = "Back", IsEnabled = _browserReady && CalendarBrowser.CanGoBack };
        back.Click += (_, _) => { if (_browserReady && CalendarBrowser.CanGoBack) CalendarBrowser.GoBack(); };
        var forward = new MenuItem { Header = "Forward", IsEnabled = _browserReady && CalendarBrowser.CanGoForward };
        forward.Click += (_, _) => { if (_browserReady && CalendarBrowser.CanGoForward) CalendarBrowser.GoForward(); };
        var home = new MenuItem { Header = "Home" };
        home.Click += (_, _) => { if (_browserReady) CalendarBrowser.Source = HomeUri; };
        var refresh = new MenuItem { Header = "Refresh" };
        refresh.Click += (_, _) => { if (_browserReady) CalendarBrowser.Reload(); };
        var startup = new MenuItem { Header = "Launch on Windows startup", IsCheckable = true, IsChecked = _startupEnabled };
        startup.Click += (_, _) => UpdateStartupSetting(startup.IsChecked);

        menu.Items.Add(back);
        menu.Items.Add(forward);
        menu.Items.Add(new Separator());
        menu.Items.Add(home);
        menu.Items.Add(refresh);
        menu.Items.Add(new Separator());
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
                runKey.SetValue(StartupValueName, $"\"{executablePath}\" --startup");
            }
            else
            {
                runKey.DeleteValue(StartupValueName, throwOnMissingValue: false);
            }
            _startupEnabled = enabled;
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show(
                $"Windows couldn't update the startup setting.\n\n{ex.Message}",
                "Startup setting unavailable",
                System.Windows.MessageBoxButton.OK,
                System.Windows.MessageBoxImage.Warning);
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
                "Would you like to open Microsoft's official download page?\n\n" +
                $"Details: {ex.Message}",
                "WebView2 Runtime required",
                System.Windows.MessageBoxButton.YesNo,
                System.Windows.MessageBoxImage.Information);

            if (result == System.Windows.MessageBoxResult.Yes)
                OpenExternal("https://developer.microsoft.com/microsoft-edge/webview2/");
        }
    }

    private void CoreWebView2_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var target))
        {
            e.Cancel = true;
            return;
        }

        if (!IsCalendarHost(target))
        {
            e.Cancel = true;
            OpenExternal(target.AbsoluteUri);
            return;
        }

        ConnectionLabel.Text = "Loading calendar…";
    }

    private void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        ConnectionLabel.Text = e.IsSuccess ? "Connected" : "Connection problem";
    }

    private void CoreWebView2_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var target))
            OpenExternal(target.AbsoluteUri);
    }

    private static bool IsCalendarHost(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttps &&
        uri.Host.Equals(HomeUri.Host, StringComparison.OrdinalIgnoreCase);

    private static void OpenExternal(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show($"Windows couldn't open this link.\n\n{ex.Message}",
                "Unable to open link", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
        }
    }
}
