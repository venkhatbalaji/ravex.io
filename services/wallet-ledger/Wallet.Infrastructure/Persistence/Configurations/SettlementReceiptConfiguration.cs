using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Wallet.Domain.Entities;
namespace Wallet.Infrastructure.Persistence.Configurations;
public sealed class SettlementReceiptConfiguration : IEntityTypeConfiguration<SettlementReceipt>
{
    public void Configure(EntityTypeBuilder<SettlementReceipt> builder)
    {
        builder.ToTable("settlement_receipts");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.PayloadHash).HasMaxLength(64).IsRequired();
    }
}
