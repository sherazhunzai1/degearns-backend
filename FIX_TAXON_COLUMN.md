# Fix: Add Taxon Column to Collections Table

## Problem
The API is returning an error: `Unknown column 'taxon' in 'field list'` when trying to create collections.

This is because the `taxon` column doesn't exist in your production database's Collections table.

## Solution
You need to add the `taxon` column to the Collections table. Follow ONE of the methods below:

---

## Method 1: Using the Node.js Script (Recommended)

This method uses your existing Node.js application and database connection.

### Steps:

1. **SSH into your production server** where the backend is running

2. **Navigate to the project directory:**
   ```bash
   cd /var/www/degearns-backend
   ```

3. **Run the migration script:**
   ```bash
   node scripts/add-taxon-column.js
   ```

4. **You should see:**
   ```
   Connecting to database...
   Adding taxon column to Collections table...
   ✓ Column "taxon" added successfully
   ✓ Index "idx_collections_taxon" added successfully
   ✓ Migration completed successfully!
   ```

5. **Restart your application** (if using PM2):
   ```bash
   pm2 restart all
   ```

---

## Method 2: Using Direct SQL

If the Node.js script doesn't work, you can run the SQL directly.

### Steps:

1. **SSH into your production server**

2. **Connect to MySQL:**
   ```bash
   mysql -u your_db_user -p
   ```

3. **Select your database:**
   ```sql
   USE xrpl_nft_marketplace;
   ```
   (Replace `xrpl_nft_marketplace` with your actual database name)

4. **Run this SQL command:**
   ```sql
   ALTER TABLE Collections
   ADD COLUMN taxon INT NOT NULL UNIQUE COMMENT 'XRPL NFToken Taxon - unique identifier to query NFTs from XRPL';
   ```

5. **Add the index:**
   ```sql
   CREATE UNIQUE INDEX idx_collections_taxon ON Collections(taxon);
   ```

6. **Verify the column was added:**
   ```sql
   DESCRIBE Collections;
   ```

7. **Exit MySQL:**
   ```sql
   exit;
   ```

8. **Restart your application** (if using PM2):
   ```bash
   pm2 restart all
   ```

---

## Method 3: Using the SQL File

1. **SSH into your production server**

2. **Navigate to the project directory:**
   ```bash
   cd /var/www/degearns-backend
   ```

3. **Run the SQL file:**
   ```bash
   mysql -u your_db_user -p your_db_name < add-taxon-column.sql
   ```

4. **Restart your application:**
   ```bash
   pm2 restart all
   ```

---

## Verification

After running the migration, verify it worked by:

1. **Check the database:**
   ```sql
   DESCRIBE Collections;
   ```

   You should see a `taxon` column with type `INT`, NOT NULL, and UNIQUE.

2. **Test the API endpoint:**
   ```bash
   curl -X POST http://your-domain.com/api/v1/collections/list \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Collection",
       "taxon": 12345,
       "creatorWalletAddress": "rYourWalletAddress"
     }'
   ```

   This should work without the "Unknown column" error.

---

## What is Taxon?

The `taxon` field is a unique identifier used by XRPL (XRP Ledger) to categorize NFTs. Each NFT collection on XRPL has a unique taxon number, and all NFTs minted with the same taxon belong to the same collection.

In your marketplace:
- Each collection must have a unique taxon
- The backend uses the taxon to query XRPL for NFTs belonging to that collection
- NFTs are NOT stored in the database; they're fetched from XRPL using the taxon

---

## Troubleshooting

### Error: "Duplicate column name 'taxon'"
This means the column already exists. You can ignore this error.

### Error: "Access denied"
You need database admin privileges. Contact your database administrator.

### Error: "Cannot find module 'sequelize'"
Make sure you're running the script from the project directory where `node_modules` is installed:
```bash
cd /var/www/degearns-backend
npm install  # If node_modules is missing
node scripts/add-taxon-column.js
```

### Still getting the error after migration?
1. Make sure you restarted your application
2. Check that you're connected to the correct database
3. Verify the column exists: `DESCRIBE Collections;`
4. Check your application logs for other errors

---

## Need Help?

If you're still having issues:
1. Check the application logs: `pm2 logs`
2. Check MySQL error logs
3. Verify database connection in your `.env` file
4. Make sure the database user has ALTER TABLE privileges
