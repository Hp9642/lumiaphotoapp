const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const fs = require('fs');
const path = require('path');

// Ensure data/events dir exists for file writes during tests
const eventDataDir = path.join(__dirname, '..', 'data', 'events');
if (!fs.existsSync(eventDataDir)) fs.mkdirSync(eventDataDir, { recursive: true });

describe('Lumina API Integration Tests', () => {
    
    // Seed database before tests
    beforeAll((done) => {
        db.serialize(() => {
            db.run("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (1, 'test@example.com', 'hash')", () => {
                db.run("INSERT OR IGNORE INTO events (id, host_id, name, shot_limit) VALUES ('TEST-EVENT', 1, 'Test Wedding', 2)", done);
            });
        });
    });

    // Clean up files after tests
    afterAll((done) => {
        const dir = path.join(eventDataDir, 'test-event');
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        done();
    });

    describe('Config API', () => {
        it('should save and load configuration via POST and GET', async () => {
            const payload = {
                shotLimit: 10,
                customMessage: 'Welcome to the test wedding!',
                enableUpload: 1,
                enableDownload: 0,
                countdownTarget: new Date('2030-01-01').toISOString()
            };

            const postRes = await request(app)
                .post('/api/config/save?eventId=TEST-EVENT')
                .send(payload)
                .set('Accept', 'application/json');
            
            expect(postRes.status).toBe(200);
            expect(postRes.body.status).toBe(200);

            const getRes = await request(app)
                .get('/api/config?eventId=TEST-EVENT')
                .set('Accept', 'application/json');

            expect(getRes.status).toBe(200);
            expect(getRes.body.shotLimit).toBe(10);
            expect(getRes.body.customMessage).toBe('Welcome to the test wedding!');
        });
    });

    describe('Photos API - Upload & Shot Limits', () => {
        it('should allow uploading a photo and store metadata including email', async () => {
            // Create a fake image buffer
            const fakeImage = Buffer.from('fake image data');

            const res = await request(app)
                .post('/api/photos?eventId=TEST-EVENT&targetFilename=testphoto.jpg')
                .set('Content-Type', 'image/jpeg')
                .set('x-meta-uploader', 'Alice')
                .set('x-meta-email', 'alice@test.com')
                .set('x-meta-note', 'Congrats!')
                .send(fakeImage);
            
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('OK');

            // Wait a moment for async DB write
            await new Promise(r => setTimeout(r, 100));

            // Verify it was added to DB and returned by GET
            const getRes = await request(app).get('/api/photos?eventId=TEST-EVENT');
            expect(getRes.status).toBe(200);
            expect(getRes.body.files).toBeDefined();
            expect(getRes.body.files.length).toBe(1);
            expect(getRes.body.files[0].uploaderName).toBe('Alice');
            expect(getRes.body.files[0].guestEmail).toBe('alice@test.com');
            expect(getRes.body.files[0].note).toBe('Congrats!');
        });

        it('should enforce shot limit on subsequent uploads', async () => {
            // Limit was set to 10 in previous test. Let's set it to 1 to test enforcement.
            await request(app)
                .post('/api/config/save?eventId=TEST-EVENT')
                .send({ 
                    shotLimit: 1, 
                    enableUpload: 1, 
                    enableDownload: 1 
                }); 

            const fakeImage = Buffer.from('second fake image');

            // This should fail because limit is 1, and 1 is already uploaded
            const res = await request(app)
                .post('/api/photos?eventId=TEST-EVENT&targetFilename=testphoto2.jpg')
                .set('Content-Type', 'image/jpeg')
                .set('x-meta-uploader', 'Bob')
                .send(fakeImage);
            
            expect(res.status).toBe(429);
            expect(res.body.error).toBe('Shot limit reached');
        });
    });
});
