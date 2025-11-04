import express from "express";
import axios from "axios";
import pool from "../infastructure/db.js";

const healthRouter = express.Router();

// Health check endpoint that verifies connections to dependencies
healthRouter.get("/", async (req, res) => {
  try {
    const healthStatus = {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "unknown" },
        flaskService: { status: "unknown" }
      }
    };

    // Check database connection
    try {
      const dbResult = await pool.query("SELECT 1");
      healthStatus.services.database = {
        status: "ok",
        responseTime: dbResult.command === "SELECT" ? "ok" : "error"
      };
    } catch (dbError) {
      healthStatus.services.database = {
        status: "error",
        error: dbError.message
      };
      healthStatus.status = "degraded";
    }

    // Check Flask service
    try {
      // Use a simple ping/health endpoint if available, or create one in your Flask app
      // For now, we'll use a short timeout to avoid long waits
      const flaskResponse = await axios.get(
  "https://lazyledger-parser.onrender.com/health",
        { timeout: 5000 }
      );
      
      healthStatus.services.flaskService = {
        status: "ok",
        statusCode: flaskResponse.status
      };
    } catch (flaskError) {
      const errorDetails = {
        message: flaskError.message,
        code: flaskError.code || "unknown"
      };
      
      if (flaskError.response) {
        errorDetails.statusCode = flaskError.response.status;
      }
      
      healthStatus.services.flaskService = {
        status: "error",
        error: errorDetails
      };
      
      // Mark as degraded if Flask is down
      healthStatus.status = "degraded";
    }

    // Determine overall status
    const anyFailed = Object.values(healthStatus.services).some(
      service => service.status === "error"
    );
    
    if (anyFailed) {
      healthStatus.status = "degraded";
      return res.status(207).json(healthStatus); // 207 Multi-Status
    }
    
    return res.status(200).json(healthStatus);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

export default healthRouter;