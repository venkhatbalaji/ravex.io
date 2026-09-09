using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MarketCatalog.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CategoryId",
                schema: "market_catalog",
                table: "markets",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "categories",
                schema: "market_catalog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_markets_CategoryId",
                schema: "market_catalog",
                table: "markets",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_categories_Name",
                schema: "market_catalog",
                table: "categories",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_markets_categories_CategoryId",
                schema: "market_catalog",
                table: "markets",
                column: "CategoryId",
                principalSchema: "market_catalog",
                principalTable: "categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_markets_categories_CategoryId",
                schema: "market_catalog",
                table: "markets");

            migrationBuilder.DropTable(
                name: "categories",
                schema: "market_catalog");

            migrationBuilder.DropIndex(
                name: "IX_markets_CategoryId",
                schema: "market_catalog",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                schema: "market_catalog",
                table: "markets");
        }
    }
}
