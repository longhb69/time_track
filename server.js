const express = require('express')
const Redis = require('ioredis')
const {Pool, Client} = require('pg')

const app = express()
const redis = new Redis()

app.use(express.json())

const port = 3000
const expireSessionTime = 360 //6 minutes

const pool = new Pool({
  user: 'eLearning-user',
  host: 'localhost',
  database: 'eLearning',
  password: '123',
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  port: 5432,
})

async function insertData(table, values) {
    try {
      const query = `INSERT INTO public.${table} (user_id, course_sections_id, time_spent) 
                      VALUES ($1, $2, $3)
                      ON CONFLICT(user_id, course_sections_id)
                      DO UPDATE SET time_spent = public.${table}.time_spent + EXCLUDED.time_spent
                      RETURNING *`;

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
        console.error('Error inserting data:', error);
        throw error;
    }
}



app.post("/track", async (req, res) => {
    const { userId, sectionId, timeSpent } = req.body;

    if (!userId || !sectionId || !timeSpent) {
      return res.status(400).json({ error: "Missing userId, sectionId, or timeSpent" });
    }

    const exists = await redis.hexists(userId, sectionId) 
    if(exists) 
    {
      console.log(`User ${userId} learning in ${sectionId}`)
      await redis.hincrby(userId, sectionId, timeSpent);
      await redis.expire(userKey, expireSessionTime);
    }
    //if user don't continue the current section 
    else 
    {
        //just delete all session if user open two or more section
        const inSection = await redis.exists(userId)
        if(inSection) {
            console.log("multiplie section in run delete session")
            await redis.del(userId)
        }
        else {
          await redis.hset(userId, sectionId, timeSpent)
          await redis.expire(userId, expireSessionTime)
        }
    }

    res.json({ message: "Tracking data saved" });
});

app.post('/insert', async (req, res) => {
    try {
        const tableName = 'user_section'; // Change this
        const insertedData = await insertData(tableName);
        res.json({ success: true, data: insertedData });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error inserting data', error });
    }
});

async function test1KQueries() {
    const totalRequests = 1000; // Number of requests
    const userId = 1;
    const courseSectionsId = 1;
    const tableName = 'user_section';

    // Generate 1K requests
    const queries = Array.from({ length: totalRequests }, (_, i) => {
        const userId = Math.floor(Math.random() * 100) + 1; // Random user ID (1-100)
        const courseSectionsId = Math.floor(Math.random() * 10) + 1; // Random section ID (1-10)
        const timeSpent = Math.floor(Math.random() * 300) + 1; // Random time spent (1-300s)

        insertData(tableName, [userId, courseSectionsId, timeSpent]) // Add 1 second per request
    });

    console.time("1K Queries Time");

    try {
        await Promise.all(queries); // Execute all queries in parallel
        console.log("✅ 1K queries executed successfully!");
    } catch (error) {
        console.error("❌ Error in 1K queries test:", error);
    }

    console.timeEnd("1K Queries Time");
}

app.post('/test1K', async (req, res) => {
  const result = await test1KQueries();
  res.json({ success: true, data: result });
})

app.get("/user-sections", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM user_section"); // No LIMIT
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.listen(port, () => console.log("Server running on port 3000"));

//docker exec -it redis1 sh
//htall