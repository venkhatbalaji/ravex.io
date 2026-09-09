using Branding.Application.Contracts;
using Branding.Domain.Entities;
using Branding.Domain.Exceptions;
using Branding.Domain.Repositories;

namespace Branding.Application.UseCases;

public interface IGetThemeUseCase
{
    Task<ThemeDto> ExecuteAsync(CancellationToken ct = default);
}

public sealed class GetThemeUseCase : IGetThemeUseCase
{
    private readonly IThemeRepository _themes;

    public GetThemeUseCase(IThemeRepository themes) => _themes = themes;

    public async Task<ThemeDto> ExecuteAsync(CancellationToken ct = default) => ThemeDto.From(await _themes.GetAsync(ct));
}

public interface IUpdateThemeUseCase
{
    Task<ThemeDto> ExecuteAsync(UpdateThemeRequest request, CancellationToken ct = default);
}

public sealed class UpdateThemeUseCase : IUpdateThemeUseCase
{
    private readonly IThemeRepository _themes;

    public UpdateThemeUseCase(IThemeRepository themes) => _themes = themes;

    public async Task<ThemeDto> ExecuteAsync(UpdateThemeRequest request, CancellationToken ct = default)
    {
        if (!Enum.TryParse<SupportedFont>(request.Font, ignoreCase: true, out var font))
            throw new InvalidThemeException(
                $"Unsupported font '{request.Font}'. Valid choices: {string.Join(", ", Enum.GetNames<SupportedFont>())}.");

        var theme = await _themes.GetAsync(ct);
        theme.Update(request.BrandName, request.LogoLightUrl, request.LogoDarkUrl, request.AccentColor, request.Accent2Color, font);
        await _themes.SaveChangesAsync(ct);
        return ThemeDto.From(theme);
    }
}
