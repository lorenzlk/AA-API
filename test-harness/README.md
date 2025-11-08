# Visual Test Harness

A beautiful, interactive web UI for testing the AA Feed Enrichment pipeline.

## Features

✨ **Drag & Drop Upload** - Drop your AA reports directly into the browser  
📊 **Live Progress** - Watch each pipeline step in real-time  
🎨 **Product Cards** - Visual display of enriched products with images  
⚡ **Real PA-API Calls** - Tests actual enrichment with your credentials  
📈 **Performance Stats** - See parse counts, success rates, and rankings  

## Quick Start

```bash
# Start the test harness server
npm run test-harness

# Or directly
node test-harness/server.js
```

Then open **http://localhost:3000** in your browser.

## What It Does

The test harness runs your AA reports through the complete pipeline:

1. **📤 Upload** - Drag/drop CSV or XLSX file
2. **📊 Parse** - Extract ASIN data from report
3. **🔢 Aggregate** - Group and count unique ASINs
4. **🏆 Rank** - Sort by performance (revenue, orders, etc.)
5. **✨ Enrich** - Fetch details from PA-API (titles, prices, images)
6. **📱 Display** - Show beautiful product cards

## API Endpoints

The server exposes these endpoints:

### `POST /api/parse`
Upload and parse AA report (CSV/XLSX/XLS)

**Request:** `multipart/form-data` with `file` field  
**Response:**
```json
{
  "success": true,
  "products": [...],
  "metadata": {
    "totalProducts": 34569,
    "validProducts": 34569,
    "source": "xlsx"
  }
}
```

### `POST /api/aggregate`
Aggregate ASINs from parsed products

**Request:**
```json
{
  "products": [...]
}
```

**Response:**
```json
{
  "success": true,
  "aggregated": [...],
  "metadata": {
    "totalAsins": 29339
  }
}
```

### `POST /api/rank`
Rank aggregated ASINs by performance

**Request:**
```json
{
  "aggregated": [...],
  "rankBy": "ordered_items",
  "topN": 10
}
```

**Response:**
```json
{
  "success": true,
  "products": [...],
  "metadata": {
    "rankedBy": "ordered_items",
    "topN": 10
  }
}
```

### `POST /api/enrich`
Enrich products with PA-API

**Request:**
```json
{
  "products": [...]
}
```

**Response:**
```json
{
  "success": true,
  "products": [...],
  "metadata": {
    "enrichedCount": 10,
    "successRate": 1.0
  },
  "failed": [],
  "errors": []
}
```

### `POST /api/pipeline`
Run the complete pipeline in one call

**Request:** `multipart/form-data` with `file` field  
**Optional fields:** `rankBy`, `topN`

**Response:**
```json
{
  "success": true,
  "parse": { "totalProducts": 34569, "source": "xlsx" },
  "aggregate": { "uniqueAsins": 29339 },
  "rank": { "topN": 10, "rankedBy": "ordered_items" },
  "enrich": { "enrichedCount": 10, "successRate": 1.0 },
  "products": [...],
  "failed": [],
  "errors": []
}
```

### `GET /api/health`
Check server and configuration status

## Configuration

The test harness uses your `config.js` file for PA-API credentials. Make sure it's configured before running:

```javascript
module.exports = {
  paApi: {
    accessKey: 'YOUR_ACCESS_KEY',
    secretKey: 'YOUR_SECRET_KEY',
    associateTag: 'your-tag-20',
    // ... other settings
  }
};
```

## Screenshots

### Upload Screen
![Upload](https://via.placeholder.com/800x400?text=Drag+%26+Drop+Upload)

### Pipeline Progress
![Progress](https://via.placeholder.com/800x400?text=Live+Pipeline+Progress)

### Product Results
![Results](https://via.placeholder.com/800x400?text=Enriched+Product+Cards)

## Use Cases

✅ **Testing New Reports** - Quickly validate different AA report formats  
✅ **Debugging PA-API** - See which ASINs fail enrichment and why  
✅ **Demos** - Show stakeholders how the system works  
✅ **Performance Testing** - Monitor enrichment success rates  
✅ **Development** - Test changes without CLI commands  

## Technical Details

- **Frontend:** Pure HTML/CSS/JS (no build step)
- **Backend:** Express.js server
- **File Upload:** Multer with 50MB limit
- **Real API Calls:** Uses your actual PA-API credentials
- **Cleanup:** Temp files automatically deleted

## Tips

💡 **Start Small:** Test with a small report first (100-1000 rows)  
💡 **Top N:** Default shows top 10 products - adjust in UI if needed  
💡 **Rate Limits:** PA-API free tier = 1 req/sec, so 10 products takes ~10s  
💡 **Images:** Some products may not have images available  
💡 **Errors:** Check browser console and server logs for details  

## Troubleshooting

**Port already in use?**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run test-harness
```

**PA-API errors?**
- Check `config.js` credentials
- Verify AssociateTag is correct
- Ensure AccessKey/SecretKey are active

**Upload fails?**
- Check file size (<50MB)
- Ensure file is CSV/XLSX/XLS format
- Check server logs for details

## Development

Want to modify the UI? Just edit `index.html` - it's a single file with inline styles and JavaScript.

Want to add new features? Edit `server.js` to add new endpoints.

No build process needed! 🎉

