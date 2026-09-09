namespace Wallet.Application.Exceptions;

public abstract class WalletApplicationException : Exception
{
    protected WalletApplicationException(string message) : base(message) { }
}

public sealed class UnknownEarnReasonException : WalletApplicationException
{
    public UnknownEarnReasonException(string reason, IReadOnlyCollection<string> validReasons)
        : base($"Unknown earn reason '{reason}'. Valid reasons: {string.Join(", ", validReasons)}.") { }
}

public sealed class AlreadyClaimedTodayException : WalletApplicationException
{
    public AlreadyClaimedTodayException(string reason)
        : base($"'{reason}' has already been claimed today.") { }
}

public sealed class InvalidStakeAmountException : WalletApplicationException
{
    public InvalidStakeAmountException() : base("Stake amount must be positive.") { }
}

public sealed class StakeConflictException : WalletApplicationException
{
    public StakeConflictException() : base("The stake ID was already used with a different payload.") { }
}

public sealed class InsufficientBalanceException : WalletApplicationException
{
    public InsufficientBalanceException(long balance, long requested)
        : base($"Balance {balance} is not enough to stake {requested}.") { }
}
