using System.Text.RegularExpressions;
using Branding.Domain.Exceptions;

namespace Branding.Domain.Entities;

/// <summary>The short, fixed list of fonts the platform apps actually preload —
/// curated on purpose (see the white-label docs) rather than an arbitrary string,
/// so every choice is guaranteed to already be on the page.</summary>
public enum SupportedFont
{
    Fredoka,
    Nunito,
    Poppins,
    SpaceGrotesk
}

/// <summary>A singleton row — one active brand configuration for this deployment.
/// True per-tenant multi-brand hosting is future work (see docs/admin-and-white-label.md).</summary>
public class Theme
{
    public static readonly Guid SingletonId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public Guid Id { get; private set; }
    public string BrandName { get; private set; } = "Predict Play";
    public string LogoLightUrl { get; private set; } = string.Empty;
    public string LogoDarkUrl { get; private set; } = string.Empty;
    public string AccentColor { get; private set; } = "#ffc53d";
    public string Accent2Color { get; private set; } = "#38bdf8";
    public SupportedFont Font { get; private set; } = SupportedFont.Fredoka;
    public DateTimeOffset UpdatedAt { get; private set; }

    private Theme()
    {
        // required by EF Core for materialization
    }

    public static Theme CreateDefault() => new()
    {
        Id = SingletonId,
        BrandName = "Predict Play",
        LogoLightUrl = string.Empty,
        LogoDarkUrl = string.Empty,
        AccentColor = "#ffc53d",
        Accent2Color = "#38bdf8",
        Font = SupportedFont.Fredoka,
        UpdatedAt = DateTimeOffset.UtcNow
    };

    public void Update(
        string brandName,
        string logoLightUrl,
        string logoDarkUrl,
        string accentColor,
        string accent2Color,
        SupportedFont font)
    {
        if (string.IsNullOrWhiteSpace(brandName))
            throw new InvalidThemeException("Brand name is required.");

        ValidateHexColor(accentColor, nameof(accentColor));
        ValidateHexColor(accent2Color, nameof(accent2Color));
        ValidateLogoUrl(logoLightUrl, nameof(logoLightUrl));
        ValidateLogoUrl(logoDarkUrl, nameof(logoDarkUrl));

        BrandName = brandName.Trim();
        LogoLightUrl = logoLightUrl?.Trim() ?? string.Empty;
        LogoDarkUrl = logoDarkUrl?.Trim() ?? string.Empty;
        AccentColor = accentColor;
        Accent2Color = accent2Color;
        Font = font;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static void ValidateHexColor(string value, string field)
    {
        if (string.IsNullOrWhiteSpace(value) || !Regex.IsMatch(value, "^#[0-9a-fA-F]{6}$"))
            throw new InvalidThemeException($"{field} must be a hex color like #ffc53d.");
    }

    private static void ValidateLogoUrl(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value)) return; // empty is allowed — falls back to the app default
        if (!value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            throw new InvalidThemeException($"{field} must be a full http(s) URL.");
    }
}
