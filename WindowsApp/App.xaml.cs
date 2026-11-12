using System.Drawing;
using System.Windows;
using System.Windows.Forms;

namespace SportsGamesCalendar;

public partial class App : System.Windows.Application
{
    private NotifyIcon? _trayIcon;
    private NotificationService? _notifications;
    private MainWindow? _mainWindow;
    private bool _allowExit;

    private void OnStartup(object sender, StartupEventArgs e)
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open The Hub", null, (_, _) => ShowMainWindow());
        menu.Items.Add("Check for event reminders now", null, async (_, _) => { if (_notifications is not null) await _notifications.CheckNowAsync(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit completely", null, (_, _) => ExitCompletely());

        _trayIcon = new NotifyIcon
        {
            Icon = GetApplicationIcon(),
            Text = "The Hub",
            ContextMenuStrip = menu,
            Visible = true
        };
        _trayIcon.DoubleClick += (_, _) => ShowMainWindow();

        _notifications = new NotificationService((title, message) =>
        {
            Dispatcher.BeginInvoke(new Action(() =>
                _trayIcon?.ShowBalloonTip(10000, title, message, ToolTipIcon.Info)));
        });
        _notifications.Start();

        // Windows "Launch on startup" should open the app normally.
        // Only an explicit --background argument starts silently in the tray.
        var startInBackground = e.Args.Any(arg =>
            arg.Equals("--background", StringComparison.OrdinalIgnoreCase));

        if (!startInBackground) ShowMainWindow();
    }

    private static Icon GetApplicationIcon()
    {
        try
        {
            var executablePath = Environment.ProcessPath;
            if (!string.IsNullOrWhiteSpace(executablePath))
                return Icon.ExtractAssociatedIcon(executablePath) ?? SystemIcons.Application;
        }
        catch { }
        return SystemIcons.Application;
    }

    public bool SendTestNotification()
    {
        if (_notifications is null) return false;
        _notifications.SendTestNotification();
        return true;
    }

    public void ShowMainWindow()
    {
        if (_mainWindow is null)
        {
            _mainWindow = new MainWindow();
            _mainWindow.Closed += (_, _) => _mainWindow = null;
        }

        _mainWindow.Show();
        _mainWindow.WindowState = WindowState.Maximized;
        _mainWindow.Activate();
    }

    public void ExitCompletely()
    {
        _allowExit = true;
        _notifications?.Dispose();
        _notifications = null;
        if (_trayIcon is not null)
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            _trayIcon = null;
        }
        _mainWindow?.Close();
        Shutdown();
    }

    public bool AllowExit => _allowExit;

    protected override void OnExit(ExitEventArgs e)
    {
        _notifications?.Dispose();
        if (_trayIcon is not null)
        {
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
        }
        base.OnExit(e);
    }
}
