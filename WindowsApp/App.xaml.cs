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
        menu.Items.Add("Open Sports & Games Calendar", null, (_, _) => ShowMainWindow());
        menu.Items.Add("Check for event reminders now", null, async (_, _) => { if (_notifications is not null) await _notifications.CheckNowAsync(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit completely", null, (_, _) => ExitCompletely());

        _trayIcon = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Text = "Sports & Games Calendar",
            ContextMenuStrip = menu,
            Visible = true
        };
        _trayIcon.DoubleClick += (_, _) => ShowMainWindow();

        _notifications = new NotificationService((title, message) =>
        {
            _trayIcon?.ShowBalloonTip(10000, title, message, ToolTipIcon.Info);
        });
        _notifications.Start();

        var startInBackground = e.Args.Any(arg =>
            arg.Equals("--startup", StringComparison.OrdinalIgnoreCase) ||
            arg.Equals("--background", StringComparison.OrdinalIgnoreCase));

        if (!startInBackground) ShowMainWindow();
    }

    public void ShowMainWindow()
    {
        if (_mainWindow is null)
        {
            _mainWindow = new MainWindow();
            _mainWindow.Closed += (_, _) => _mainWindow = null;
        }

        _mainWindow.Show();
        _mainWindow.WindowState = WindowState.Normal;
        _mainWindow.Activate();
    }

    public void ExitCompletely()
    {
        _allowExit = true;
        _notifications?.Dispose();
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
