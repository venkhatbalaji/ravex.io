using MarketCatalog.Domain.Exceptions;

namespace MarketCatalog.Domain.Entities;

public class Market
{
    private readonly List<Outcome> _outcomes = new();

    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DateTimeOffset EventStartAt { get; private set; }
    public MarketStatus Status { get; private set; }
    public Guid? WinningOutcomeId { get; private set; }
    public Guid? CategoryId { get; private set; }
    public string ResultSource { get; private set; } = "";
    public Guid? ResolvedBy { get; private set; }
    public DateTimeOffset? ResolutionRequestedAt { get; private set; }
    public DateTimeOffset? ResolvedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public IReadOnlyList<Outcome> Outcomes => _outcomes;

    private Market()
    {
        // required by EF Core for materialization
    }

    public static Market Create(
        string title,
        string description,
        DateTimeOffset eventStartAt,
        IReadOnlyList<string> outcomeLabels,
        Guid? categoryId = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new InvalidMarketDefinitionException("A market needs a title.");
        if (outcomeLabels is null || outcomeLabels.Count < 2)
            throw new InvalidMarketDefinitionException("A market needs at least two outcomes.");

        var market = new Market
        {
            Id = Guid.NewGuid(),
            Title = title,
            Description = description,
            EventStartAt = eventStartAt,
            Status = MarketStatus.Open,
            CategoryId = categoryId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        foreach (var label in outcomeLabels)
            market._outcomes.Add(Outcome.Create(market.Id, label));

        return market;
    }

    /// <summary>No further stakes may be accepted once a market locks.</summary>
    public void Lock()
    {
        if (Status != MarketStatus.Open)
            throw new InvalidMarketStateException($"A market must be open to lock; this one is {Status}.");

        Status = MarketStatus.Locked;
    }

    public void BeginResolution(Guid? winner, bool cancel, string source, Guid actor)
    {
        if (string.IsNullOrWhiteSpace(source) || source.Trim().Length > 500 || actor == Guid.Empty)
            throw new InvalidMarketDefinitionException("Provide result evidence or a cancellation reason (up to 500 characters).");
        if (Status is MarketStatus.Settling or MarketStatus.Refunding or MarketStatus.Settled or MarketStatus.Cancelled)
        {
            var wasCancel = Status is MarketStatus.Refunding or MarketStatus.Cancelled;
            if (wasCancel == cancel && WinningOutcomeId == winner && ResultSource == source.Trim()) return;
            throw new InvalidMarketStateException("A different result or cancellation has already been recorded.");
        }
        if (!cancel && Status != MarketStatus.Locked)
            throw new InvalidMarketStateException("Lock the market before recording a result.");
        if (!cancel && !_outcomes.Any(o => o.Id == winner)) throw new UnknownOutcomeException(winner ?? Guid.Empty);
        WinningOutcomeId = winner;
        ResultSource = source.Trim();
        ResolvedBy = actor;
        ResolutionRequestedAt = DateTimeOffset.UtcNow;
        Status = cancel ? MarketStatus.Refunding : MarketStatus.Settling;
    }

    public void CompleteResolution()
    {
        Status = Status switch
        {
            MarketStatus.Settling => MarketStatus.Settled,
            MarketStatus.Refunding => MarketStatus.Cancelled,
            _ => throw new InvalidMarketStateException("No resolution is processing.")
        };
        ResolvedAt = DateTimeOffset.UtcNow;
    }
}
