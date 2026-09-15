using Wallet.Application.Abstractions;

namespace Wallet.Infrastructure.Configuration;

/// <summary>
/// Fixed in-process earn rates for local dev and the single-tenant build.
/// A white-label deployment swaps this for a catalog backed by per-tenant
/// config, without the Application layer's use cases changing at all.
/// </summary>
public sealed class StaticEarnRateCatalog : IEarnRateCatalog
{
    private static readonly IReadOnlyDictionary<string, long> Rates = new Dictionary<string, long>
    {
        ["daily_login"] = 50
    };

    public bool TryGetRate(string reason, out long amount) => Rates.TryGetValue(reason, out amount);

    public IReadOnlyCollection<string> ValidReasons => (IReadOnlyCollection<string>)Rates.Keys;
}
