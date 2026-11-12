# The Hub for Windows

A lightweight Windows desktop shell for The Hub website. The app uses Microsoft's WebView2 control and always loads the current website rather than bundling a stale copy of the calendar.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- Microsoft Edge WebView2 Runtime (Evergreen). Most modern Windows PCs already have it. If it is missing, the app offers to open Microsoft's official download page.
- Internet connection.

## Build locally

Install the .NET 10 SDK, then run from the repository root:

```powershell
dotnet publish .\WindowsApp\SportsGamesCalendar.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o .\publish
```

The executable is `publish\TheHub.exe`.

## Download a built executable

The GitHub Actions workflow **Build Windows desktop app** builds the x64 executable on a Windows runner and uploads it as the `TheHub-Windows-x64` artifact. Open the successful workflow run in GitHub Actions and download that artifact ZIP.

## Notes

- The .NET runtime is bundled into the published executable.
- WebView2 Runtime is a separate Microsoft prerequisite and is not bundled.
- Closing the main window hides the app in the Windows system tray; reminders continue while it runs in the background. Use the tray menu and choose **Exit completely** to stop reminders.
- The app checks published sports, Speedway and verified featured-game feeds every 15 minutes and shows a Windows notification for an event within the next 24 hours. Sent reminders are recorded locally to avoid duplicates.
- Right-click the tray icon to reopen the calendar or check reminders immediately.
- The shared bell in the website header lists upcoming events and releases for the next 14 days; read state is stored in that browser profile.
- The app opens links outside the calendar website in your default browser.
- The toolbar checkbox **Launch on Windows startup** adds or removes a per-user Windows Run registry entry. It is off by default and can be changed at any time; no administrator access is required.
- The app requires internet access because the live website is its content source.
