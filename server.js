const express = require('express')
const Redis = require('ioredis')

const app = express()
const redis = new Redis()

app.use(express.json())

const port = 3000
const expireSessionTime = 360 //6 minutes

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

app.listen(port, () => console.log("Server running on port 3000"));

//docker exec -it redis1 sh
//htall