namespace Wallet.Application.Abstractions;

/// <summary>
/// How many coins each earn reason is worth. Kept as an injected abstraction —
/// not a constant in the use case — so a white-label tenant can swap in a
/// config-backed catalog without touching the earn flow itself.
/// </summary>
public interface IEarnRateCatalog
{
    bool TryGetRate(string reason, out long amount);
    IReadOnlyCollection<string> ValidReasons { get; }
}
