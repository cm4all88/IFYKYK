# Run this once to create Spotlightly billing tier products in Stripe
# Then add the price IDs to Vercel env vars

$key = "sk_live_YOUR_KEY_HERE"  # Replace with your live Stripe key

$tiers = @(
    @{ name="Spotlightly Starter"; desc="Up to 100 subscribers"; price=2900;  meta="starter" },
    @{ name="Spotlightly Growth";  desc="Up to 500 subscribers"; price=7900;  meta="growth"  },
    @{ name="Spotlightly Pro";     desc="Up to 2500 subscribers"; price=24900; meta="pro"     },
    @{ name="Spotlightly Scale";   desc="Up to 10000 subscribers"; price=74900; meta="scale"   },
    @{ name="Spotlightly Legend";  desc="Unlimited subscribers";  price=349900; meta="legend"  }
)

foreach ($tier in $tiers) {
    # Create product
    $prod = curl.exe -s https://api.stripe.com/v1/products `
        -u "${key}:" `
        -d "name=$($tier.name)" `
        -d "description=$($tier.desc)" `
        -d "metadata[tier]=$($tier.meta)" | ConvertFrom-Json

    # Create price
    $price = curl.exe -s https://api.stripe.com/v1/prices `
        -u "${key}:" `
        -d "product=$($prod.id)" `
        -d "currency=usd" `
        -d "unit_amount=$($tier.price)" `
        -d "recurring[interval]=month" `
        -d "metadata[tier]=$($tier.meta)" | ConvertFrom-Json

    Write-Host "$($tier.meta.ToUpper()): $($price.id)"
}

Write-Host ""
Write-Host "Add these to Vercel environment variables:"
Write-Host "STRIPE_PRICE_STARTER = price_..."
Write-Host "STRIPE_PRICE_GROWTH  = price_..."
Write-Host "STRIPE_PRICE_PRO     = price_..."
Write-Host "STRIPE_PRICE_SCALE   = price_..."
Write-Host "STRIPE_PRICE_LEGEND  = price_..."
