# Sports & Games Calendar for Windows

A lightweight Windows desktop shell for the live Sports & Games Calendar website. The app uses Microsoft's WebView2 control and always loads the current website rather than bundling a stale copy of the calendar.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- Microsoft Edge WebView2 Runtime (Evergreen). Most modern Windows PCs already have it. If it is missing, the app offers to open Microsoft's official download page.
- Internet connection.

## Build locally

Install the .NET 8 SDK, then run from the repository root:

```powershell
dotnet publish .\WindowsApp\SportsGamesCalendar.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o .\publish
```

The executable is `publish\SportsGamesCalendar.exe`.

## Download a built executable

The GitHub Actions workflow **Build Windows desktop app** builds the x64 executable on a Windows runner and uploads it as the `SportsGamesCalendar-Windows-x64` artifact. Open the successful workflow run in GitHub Actions and download that artifact ZIP.

## Notes

- The .NET runtime is bundled into the published executable.
- WebView2 Runtime is a separate Microsoft prerequisite and is not bundled.
- The app opens links outside the calendar website in your default browser.
- The app requires internet access because the live website is its content source.
