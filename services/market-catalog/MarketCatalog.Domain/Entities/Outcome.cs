namespace MarketCatalog.Domain.Entities;

public class Outcome
{
    public Guid Id { get; private set; }
    public string Label { get; private set; } = string.Empty;
    public Guid MarketId { get; private set; }

    private Outcome()
    {
        // required by EF Core for materialization
    }

    internal static Outcome Create(Guid marketId, string label) => new()
    {
        Id = Guid.NewGuid(),
        MarketId = marketId,
        Label = label
    };
}
