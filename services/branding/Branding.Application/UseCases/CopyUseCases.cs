using Branding.Application.Contracts;
using Branding.Domain.Entities;
using Branding.Domain.Repositories;

namespace Branding.Application.UseCases;

public interface IGetCopyOverridesUseCase
{
    Task<IReadOnlyList<CopyOverrideDto>> ExecuteAsync(CancellationToken ct = default);
}

public sealed class GetCopyOverridesUseCase : IGetCopyOverridesUseCase
{
    private readonly ICopyOverrideRepository _copy;

    public GetCopyOverridesUseCase(ICopyOverrideRepository copy) => _copy = copy;

    public async Task<IReadOnlyList<CopyOverrideDto>> ExecuteAsync(CancellationToken ct = default) =>
        (await _copy.GetAllAsync(ct)).Select(c => new CopyOverrideDto(c.Key, c.Value)).ToList();
}

public interface IUpsertCopyOverrideUseCase
{
    Task<CopyOverrideDto> ExecuteAsync(string key, UpsertCopyOverrideRequest request, CancellationToken ct = default);
}

public sealed class UpsertCopyOverrideUseCase : IUpsertCopyOverrideUseCase
{
    private readonly ICopyOverrideRepository _copy;

    public UpsertCopyOverrideUseCase(ICopyOverrideRepository copy) => _copy = copy;

    public async Task<CopyOverrideDto> ExecuteAsync(string key, UpsertCopyOverrideRequest request, CancellationToken ct = default)
    {
        var existing = await _copy.GetByKeyAsync(key, ct);
        if (existing is null)
        {
            var entry = CopyOverride.Create(key, request.Value);
            await _copy.AddAsync(entry, ct);
            return new CopyOverrideDto(entry.Key, entry.Value);
        }

        existing.UpdateValue(request.Value);
        await _copy.SaveChangesAsync(ct);
        return new CopyOverrideDto(existing.Key, existing.Value);
    }
}

public interface IDeleteCopyOverrideUseCase
{
    Task ExecuteAsync(string key, CancellationToken ct = default);
}

public sealed class DeleteCopyOverrideUseCase : IDeleteCopyOverrideUseCase
{
    private readonly ICopyOverrideRepository _copy;

    public DeleteCopyOverrideUseCase(ICopyOverrideRepository copy) => _copy = copy;

    public async Task ExecuteAsync(string key, CancellationToken ct = default)
    {
        var existing = await _copy.GetByKeyAsync(key, ct);
        if (existing is null) return; // already at the default — reverting again is a no-op success

        await _copy.DeleteAsync(existing, ct);
    }
}
