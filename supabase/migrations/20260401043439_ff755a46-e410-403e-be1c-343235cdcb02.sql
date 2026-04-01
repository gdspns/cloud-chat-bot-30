-- Add image_url column to shop_products
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to product-images bucket
CREATE POLICY "Anyone can upload product images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'product-images');

-- Allow anyone to read product images
CREATE POLICY "Anyone can read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow anyone to update product images
CREATE POLICY "Anyone can update product images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'product-images');

-- Allow anyone to delete product images
CREATE POLICY "Anyone can delete product images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'product-images');