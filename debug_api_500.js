import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT || 8000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function test() {
    console.log("Starting debug request test...");

    // 1. Signup a user to get a real UUID
    const email = `debug${Date.now()}@test.com`;
    let userId;
    try {
        const signupRes = await axios.post(`${BASE_URL}/auth/signup`, {
            email,
            password: "password123",
            nickname: "tester"
        });
        userId = signupRes.data.user.id;
        console.log("Signup success, userId:", userId);
    } catch (err) {
        console.error("Signup failed:", err.response?.data || err.message);
        return;
    }

    // 2. Try to post a meal log
    try {
        const mealRes = await axios.post(`${BASE_URL}/meals`, {
            userId,
            foodCode: "test_food_123", // Note: This might fail FK if foods table is empty and FK check is on
            servings: 2,
            mealType: "lunch"
        });
        console.log("Meal log success:", mealRes.data);
    } catch (err) {
        console.log("Meal log FAILED as expected/unexpected:", err.response?.status, err.response?.data);
        if (err.response?.status === 500) {
            console.log("ROOT CAUSE of 500 found in Meals API!");
        }
    }
}

test();
