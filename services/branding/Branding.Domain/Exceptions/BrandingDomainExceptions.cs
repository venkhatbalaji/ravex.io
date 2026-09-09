namespace Branding.Domain.Exceptions;

public abstract class BrandingDomainException : Exception
{
    protected BrandingDomainException(string message) : base(message) { }
}

public sealed class InvalidThemeException : BrandingDomainException
{
    public InvalidThemeException(string message) : base(message) { }
}

public sealed class InvalidCopyOverrideException : BrandingDomainException
{
    public InvalidCopyOverrideException(string message) : base(message) { }
}
