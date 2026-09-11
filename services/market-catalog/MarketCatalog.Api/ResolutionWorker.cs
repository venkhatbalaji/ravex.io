using MarketCatalog.Application.Abstractions;
using MarketCatalog.Domain.Entities;
using MarketCatalog.Domain.Repositories;

namespace MarketCatalog.Api;

public sealed class ResolutionWorker(IServiceScopeFactory scopes, ILogger<ResolutionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                List<Guid> ids;
                using (var scope = scopes.CreateScope())
                {
                    var repo = scope.ServiceProvider.GetRequiredService<IMarketRepository>();
                    var settling = await repo.GetAllAsync(MarketStatus.Settling, stoppingToken);
                    var refunding = await repo.GetAllAsync(MarketStatus.Refunding, stoppingToken);
                    ids = settling.Concat(refunding).Select(m => m.Id).ToList();
                }
                foreach (var id in ids)
                {
                    try
                    {
                        using var scope = scopes.CreateScope();
                        var repo = scope.ServiceProvider.GetRequiredService<IMarketRepository>();
                        var market = await repo.GetByIdAsync(id, stoppingToken);
                        if (market is null || market.Status is not (MarketStatus.Settling or MarketStatus.Refunding)) continue;
                        var admission = scope.ServiceProvider.GetRequiredService<IStakeAdmission>();
                        if (!await admission.ResolveAsync(id, stoppingToken)) continue;
                        market.CompleteResolution();
                        await repo.SaveChangesAsync(stoppingToken);
                    }
                    catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning(ex, "Resolution {MarketId} will retry", id); }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning(ex, "Resolution scan will retry"); }
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
