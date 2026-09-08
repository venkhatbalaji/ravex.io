namespace Wallet.Domain.Entities;

public enum AccountOwnerType
{
    User,
    House,
    Pool
}

public class Account
{
    public static readonly Guid HouseAccountId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>Escrow for coins currently staked in open markets — separate from House, which is
    /// where earned coins come from. Pool nets to zero once a market's stakes are all settled.</summary>
    public static readonly Guid PoolAccountId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    public Guid Id { get; private set; }
    public AccountOwnerType OwnerType { get; private set; }
    public Guid? OwnerUserId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private Account()
    {
        // required by EF Core for materialization
    }

    public static Account ForUser(Guid userId) => new()
    {
        Id = Guid.NewGuid(),
        OwnerType = AccountOwnerType.User,
        OwnerUserId = userId,
        CreatedAt = DateTimeOffset.UtcNow
    };

    public static Account House() => new()
    {
        Id = HouseAccountId,
        OwnerType = AccountOwnerType.House,
        OwnerUserId = null,
        CreatedAt = DateTimeOffset.UtcNow
    };

    public static Account Pool() => new()
    {
        Id = PoolAccountId,
        OwnerType = AccountOwnerType.Pool,
        OwnerUserId = null,
        CreatedAt = DateTimeOffset.UtcNow
    };
}
