using Branding.Domain.Exceptions;

namespace Branding.Domain.Entities;

/// <summary>One key -> string override of the app's built-in copy default.
/// Not multi-language i18n — a single active brand voice, see the white-label docs.</summary>
public class CopyOverride
{
    public string Key { get; private set; } = string.Empty;
    public string Value { get; private set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; private set; }

    private CopyOverride()
    {
        // required by EF Core for materialization
    }

    public static CopyOverride Create(string key, string value)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidCopyOverrideException("A copy key is required.");

        return new CopyOverride { Key = key.Trim(), Value = value ?? string.Empty, UpdatedAt = DateTimeOffset.UtcNow };
    }

    public void UpdateValue(string value)
    {
        Value = value ?? string.Empty;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
