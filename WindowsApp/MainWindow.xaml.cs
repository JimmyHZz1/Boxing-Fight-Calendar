using System.Diagnostics;
using System.Windows;
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
    private bool _loadingStartupSetting;

    public MainWindow()
    {
        InitializeComponent();
        LoadStartupSetting();
        Loaded += MainWindow_Loaded;
    }

    private void LoadStartupSetting()
    {
        _loadingStartupSetting = true;
        try
        {
            using var runKey = Registry.CurrentUser.OpenSubKey(StartupRunKey, writable: false);
            StartupCheckBox.IsChecked = runKey?.GetValue(StartupValueName) is string;
        }
        catch
        {
            StartupCheckBox.IsChecked = false;
        }
        finally
        {
            _loadingStartupSetting = false;
        }
    }

    private void StartupCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        if (_loadingStartupSetting) return;

        try
        {
            using var runKey = Registry.CurrentUser.CreateSubKey(StartupRunKey, writable: true);
            if (StartupCheckBox.IsChecked == true)
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
        }
        catch (Exception ex)
        {
            _loadingStartupSetting = true;
            StartupCheckBox.IsChecked = !StartupCheckBox.IsChecked;
            _loadingStartupSetting = false;

            MessageBox.Show(
                $"Windows couldn't update the startup setting.\n\n{ex.Message}",
                "Startup setting unavailable",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
        }
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        ConnectionLabel.Text = "Starting browser…";

        try
        {
            var runtimeVersion = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (string.IsNullOrWhiteSpace(runtimeVersion))
            {
                throw new InvalidOperationException("The Microsoft Edge WebView2 Runtime is not installed.");
            }

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
            var result = MessageBox.Show(
                "The Microsoft Edge WebView2 Runtime is required to run this application.\n\n" +
                "Would you like to open Microsoft's official download page?\n\n" +
                $"Details: {ex.Message}",
                "WebView2 Runtime required",
                MessageBoxButton.YesNo,
                MessageBoxImage.Information);

            if (result == MessageBoxResult.Yes)
            {
                OpenExternal("https://developer.microsoft.com/microsoft-edge/webview2/");
            }
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
        BackButton.IsEnabled = CalendarBrowser.CanGoBack;
        ForwardButton.IsEnabled = CalendarBrowser.CanGoForward;
        ConnectionLabel.Text = e.IsSuccess ? "Connected" : "Connection problem";
    }

    private void CoreWebView2_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var target))
        {
            OpenExternal(target.AbsoluteUri);
        }
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
            MessageBox.Show($"Windows couldn't open this link.\n\n{ex.Message}",
                "Unable to open link", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void BackButton_Click(object sender, RoutedEventArgs e)
    {
        if (_browserReady && CalendarBrowser.CanGoBack) CalendarBrowser.GoBack();
    }

    private void ForwardButton_Click(object sender, RoutedEventArgs e)
    {
        if (_browserReady && CalendarBrowser.CanGoForward) CalendarBrowser.GoForward();
    }

    private void HomeButton_Click(object sender, RoutedEventArgs e)
    {
        if (_browserReady) CalendarBrowser.Source = HomeUri;
    }

    private void RefreshButton_Click(object sender, RoutedEventArgs e)
    {
        if (_browserReady) CalendarBrowser.Reload();
    }
}
