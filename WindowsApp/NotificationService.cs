using System.IO;
using System.Net.Http;
using System.Text.Json;

namespace SportsGamesCalendar;

public sealed class NotificationService : IDisposable
{
    private const string SiteRoot = "https://jimmyhzz1.github.io/Boxing-Fight-Calendar/";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };
    private readonly Action<string, string> _notify;
    private readonly System.Threading.Timer _timer;
    private readonly HashSet<string> _sent = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _statePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SportsGamesCalendar", "sent-notifications.json");
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _preferencesPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SportsGamesCalendar", "notification-preferences.json");

    public NotificationService(Action<string, string> notify)
    {
        _notify = notify;
        LoadSentState();
        _timer = new System.Threading.Timer(async _ => await CheckNowAsync(), null,
            TimeSpan.FromSeconds(20), TimeSpan.FromMinutes(15));
    }

    public void Start() => _ = CheckNowAsync();

    public async Task CheckNowAsync()
    {
        if (!await _gate.WaitAsync(0)) return;
        try
        {
            var candidates = new List<CalendarReminder>();
            await ReadFeedAsync("data/f1.json", "Formula 1", candidates, "events");
            await ReadFeedAsync("data/darts.json", "PDC Darts", candidates, "events");
            await ReadFeedAsync("data/ufc.json", "UFC", candidates, "events");
            await ReadFeedAsync("data/bkfc.json", "BKFC", candidates, "events");
            await ReadFeedAsync("data/fights.json", "Boxing", candidates, "events");
            await ReadSpeedwayAsync(candidates);
            await ReadGamesAsync(candidates);

            var preferences = LoadPreferences();
            var now = DateTimeOffset.Now;
            var due = candidates
                .Where(item => IsCategoryEnabled(item.Category, preferences) && ((item.StartsAt > now && item.StartsAt <= now.AddDays(preferences.LeadDays)) || (item.IsDateOnly && item.StartsAt.Date == now.Date)))
                .OrderBy(item => item.StartsAt)
                .ToList();

            foreach (var item in due)
            {
                if (!_sent.Add(item.Id)) continue;
                var when = item.StartsAt.ToLocalTime().ToString("ddd d MMM, HH:mm");
                _notify($"{item.Category}: {item.Title}", $"Starts {when}. Open Sports & Games Calendar for details.");
            }

            if (due.Count > 0) SaveSentState();
        }
        catch
        {
            // A failed feed must never stop the background notification process.
        }
        finally
        {
            _gate.Release();
        }
    }

    private static async Task ReadFeedAsync(string path, string category,
        List<CalendarReminder> output, string arrayName)
    {
        try
        {
            using var stream = await Http.GetStreamAsync(new Uri(new Uri(SiteRoot), path));
            using var document = await JsonDocument.ParseAsync(stream);
            if (!document.RootElement.TryGetProperty(arrayName, out var events) ||
                events.ValueKind != JsonValueKind.Array) return;

            foreach (var item in events.EnumerateArray())
            {
                if (category == "Boxing" && item.TryGetProperty("source_note", out _)) continue;
                AddReminder(item, category, output, "date", "start_at", "start_time_utc");
            }
        }
        catch { }
    }

    private static async Task ReadSpeedwayAsync(List<CalendarReminder> output)
    {
        try
        {
            using var stream = await Http.GetStreamAsync(new Uri(new Uri(SiteRoot), "data/speedway.json"));
            using var document = await JsonDocument.ParseAsync(stream);
            if (!document.RootElement.TryGetProperty("competitions", out var competitions)) return;
            foreach (var competition in competitions.EnumerateObject())
            {
                if (!competition.Value.TryGetProperty("events", out var events) ||
                    events.ValueKind != JsonValueKind.Array) continue;
                foreach (var item in events.EnumerateArray())
                    AddReminder(item, "FIM Speedway", output, "date", "start_at");
            }
        }
        catch { }
    }

    private static async Task ReadGamesAsync(List<CalendarReminder> output)
    {
        try
        {
            using var stream = await Http.GetStreamAsync(new Uri(new Uri(SiteRoot), "data/games-featured.json"));
            using var document = await JsonDocument.ParseAsync(stream);
            if (!document.RootElement.TryGetProperty("games", out var games) ||
                games.ValueKind != JsonValueKind.Array) return;
            foreach (var game in games.EnumerateArray())
            {
                if (game.TryGetProperty("verification_status", out var verified) &&
                    verified.ValueKind == JsonValueKind.String &&
                    !verified.GetString()!.Equals("verified", StringComparison.OrdinalIgnoreCase)) continue;
                AddReminder(game, "Game release", output, "release_date", "date");
            }
        }
        catch { }
    }

    private static void AddReminder(JsonElement item, string category,
        List<CalendarReminder> output, params string[] dateFields)
    {
        var title = ReadString(item, "name") ?? ReadString(item, "title");
        if (string.IsNullOrWhiteSpace(title)) return;

        DateTimeOffset? startsAt = null;
        var isDateOnly = false;
        foreach (var field in dateFields)
        {
            var raw = ReadString(item, field);
            if (string.IsNullOrWhiteSpace(raw)) continue;
            if (DateOnly.TryParseExact(raw, "yyyy-MM-dd", out var date))
            {
                var localStart = date.ToDateTime(new TimeOnly(9, 0));
                startsAt = new DateTimeOffset(localStart, TimeZoneInfo.Local.GetUtcOffset(localStart));
                isDateOnly = true;
                break;
            }
            if (DateTimeOffset.TryParse(raw, out var parsed))
            {
                startsAt = parsed;
                break;
            }
        }

        if (startsAt is null) return;
        var id = ReadString(item, "id") ?? $"{category}|{title}|{startsAt:O}";
        output.Add(new CalendarReminder(id, category, title, startsAt.Value, isDateOnly));
    }

    private static string? ReadString(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var value)) return null;
        return value.ValueKind == JsonValueKind.String ? value.GetString() :
            value.ValueKind == JsonValueKind.Number ? value.ToString() : null;
    }

    private NotificationPreferences LoadPreferences()
    {
        try
        {
            if (!File.Exists(_preferencesPath)) return new NotificationPreferences();
            return JsonSerializer.Deserialize<NotificationPreferences>(File.ReadAllText(_preferencesPath), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new NotificationPreferences();
        }
        catch { return new NotificationPreferences(); }
    }

    private static bool IsCategoryEnabled(string category, NotificationPreferences preferences)
    {
        var key = category switch
        {
            "Formula 1" => "FORMULA 1", "PDC Darts" => "PDC DARTS", "Boxing" => "BOXING",
            "UFC" => "UFC", "BKFC" => "BKFC", "FIM Speedway" => "FIM SPEEDWAY",
            "Game release" => "GAME RELEASE", _ => category.ToUpperInvariant()
        };
        return !preferences.Categories.TryGetValue(key, out var enabled) || enabled;
    }

    private void LoadSentState()
    {
        try
        {
            if (!File.Exists(_statePath)) return;
            var saved = JsonSerializer.Deserialize<List<string>>(File.ReadAllText(_statePath));
            if (saved is not null) foreach (var id in saved) _sent.Add(id);
        }
        catch { }
    }

    private void SaveSentState()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_statePath)!);
            File.WriteAllText(_statePath, JsonSerializer.Serialize(_sent));
        }
        catch { }
    }

    public void SendTestNotification()
    {
        _notify("Sports & Games Calendar test", "Windows notifications are connected. Event reminders can be delivered by this app.");
    }

    public void Dispose()
    {
        _timer.Dispose();
    }

    private sealed class NotificationPreferences
    {
        public int LeadDays { get; set; } = 14;
        public Dictionary<string, bool> Categories { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    private sealed record CalendarReminder(string Id, string Category, string Title, DateTimeOffset StartsAt, bool IsDateOnly);
}
