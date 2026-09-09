using Branding.Domain.Entities;

namespace Branding.Application.Contracts;

public record ThemeDto(
    string BrandName,
    string LogoLightUrl,
    string LogoDarkUrl,
    string AccentColor,
    string Accent2Color,
    string Font)
{
    public static ThemeDto From(Theme theme) => new(
        theme.BrandName, theme.LogoLightUrl, theme.LogoDarkUrl, theme.AccentColor, theme.Accent2Color, theme.Font.ToString());
}

public record UpdateThemeRequest(
    string BrandName,
    string LogoLightUrl,
    string LogoDarkUrl,
    string AccentColor,
    string Accent2Color,
    string Font);

public record CopyOverrideDto(string Key, string Value);
public record UpsertCopyOverrideRequest(string Value);
