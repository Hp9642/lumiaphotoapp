require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// POST /api/photos/download
async function downloadPhotos(req, res) {
    const accountName = process.env.AZ_STORAGE_ACCOUNT_NAME;
    
    // Validate management password
    if(req.body.password !== process.env.WPA_MANAGE_PASSWORD) {
        return res.status(401).json({ 
            status: 401, 
            message: 'Unauthorized', 
            details: 'Incorrect password.' 
        });
    }

    try {
        if (!accountName) {
            const originalDir = path.join(__dirname, '..', 'public', 'uploads', 'original');
            if (!fs.existsSync(originalDir) || fs.readdirSync(originalDir).length === 0) {
                return res.status(404).json({
                    status: 404,
                    message: 'Not Found',
                    details: 'No photos uploaded yet.'
                });
            }

            const zip = new AdmZip();
            zip.addLocalFolder(originalDir);
            
            const zipBuffer = zip.toBuffer();

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename=wedding_photos.zip');
            res.send(zipBuffer);
        } else {
            return res.status(501).json({
                status: 501,
                message: 'Not Implemented',
                details: 'Azure bulk download is not supported via this local endpoint; download from the Azure Portal.'
            });
        }
    } catch(error) {
        console.error("Download failed:", error);
        res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            details: 'Could not download photos.'
        });
    }
}
  
module.exports = { 
    downloadPhotos
}