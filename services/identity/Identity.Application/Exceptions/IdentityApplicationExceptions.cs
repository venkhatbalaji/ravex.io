namespace Identity.Application.Exceptions;

public abstract class IdentityApplicationException : Exception
{
    protected IdentityApplicationException(string message) : base(message) { }
}

public sealed class EmailAlreadyRegisteredException : IdentityApplicationException
{
    public EmailAlreadyRegisteredException(string email) : base($"An account with email '{email}' already exists.") { }
}

public sealed class InvalidCredentialsException : IdentityApplicationException
{
    public InvalidCredentialsException() : base("Invalid email or password.") { }
}

public sealed class WeakPasswordException : IdentityApplicationException
{
    public WeakPasswordException() : base("Password must be at least 8 characters.") { }
}
