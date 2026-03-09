import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { getRandomFoods, searchFoodsByKeywords, saveRecommendationResult } from '../models/recommendModel.js';
import { findUserById } from '../models/userModel.js';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * [GET] /api/recommend/random
 * 초기 랜덤 식단 조회 데이터 (5개) 반환
 */
export const getRandomFoodList = async (req, res) => {
    try {
        const foods = await getRandomFoods(5);

        return res.status(200).json({
            success: true,
            message: "저장되었습니다.", // 명세서 기준 메시지
            foods: foods.map(f => ({
                id: f.id,
                name: f.name,
                image: null
            }))
        });
    } catch (error) {
        console.error("getRandomFoodList 에러:", error);
        return res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};

/**
 * [POST] /api/recommendation/save
 * 대화 내역(messages)과 inputMessage를 받아 AI로부터 키워드를 추출하고 DB에서 음식을 찾아 반환
 */
export const recommendFoodsByAI = async (req, res) => {
    try {
        const userId = req.user?.id; // 인증 미들웨어 통해 넘어옴
        if (!userId) {
            return res.status(401).json({ success: false, message: "인증 정보가 없습니다." });
        }

        const { messages, inputMessage } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, message: "올바르지 않은 대화 요청입니다." });
        }

        // 1. 사용자 신체 프로필 가져오기 (보다 정확한 AI 추천용 컨텍스트)
        const user = await findUserById(userId);
        let userContext = "목표: 건강 유지";
        if (user) {
            userContext = `사용자 목표: ${user.goals}, 식이 제한 사항: ${user.dietary_restrictions}, 키: ${user.height}cm, 체중: ${user.weight}kg.`;
        }

        // 2. OpenAI 채팅 호출 (키워드 추출 목적)
        const promptMessages = [
            {
                role: "system",
                content: `당신은 영양 전문가입니다. 사용자의 정보와 이전 대화를 바탕으로, 사용자에게 추천할 만한 식재료나 요리명 단어 3개를 쉼표(,)로만 구분해서 출력하세요. 다른 문장은 절대 포함하지 마세요.\n[사용자정보] ${userContext}`
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: inputMessage }
        ];

        let aiKeywordsString = "";

        if (process.env.OPENAI_API_KEY) {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: promptMessages,
                max_tokens: 30,
                temperature: 0.7
            });
            aiKeywordsString = completion.choices[0].message.content.trim();
        } else {
            // OPENAI API 키가 없는 경우 더미 데이터 폴백 처리
            console.warn("OPENAI_API_KEY is not set. Using fallback keywords.");
            const dummyKeywords = ["닭가슴살", "고구마", "샐러드"];
            aiKeywordsString = dummyKeywords.join(", ");
        }

        console.log("AI 추천 키워드:", aiKeywordsString);

        // 3. 추출된 키워드 배열화
        const keywords = aiKeywordsString
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);

        // 4. foods 테이블 조회하여 유사 식품 찾기
        let recommendedFoods = await searchFoodsByKeywords(keywords);

        // 만약 검색된 음식이 없다면 랜덤 음식으로 폴백
        if (!recommendedFoods || recommendedFoods.length === 0) {
            console.log("키워드 매칭 실패. 랜덤 음식 반환");
            recommendedFoods = await getRandomFoods(3);
        }

        // 최대 3개까지만 자르기
        recommendedFoods = recommendedFoods.slice(0, 3);

        // 프론트 명세 맞춰 데이터 정제
        const responseFoodsList = recommendedFoods.map(f => ({
            id: f.id,
            name: f.name,
            image: f.image // 없을경우 null
        }));

        // 5. 추천 기록 DB(recommendations 테이블) 저장
        const recId = uuidv4();
        await saveRecommendationResult(recId, userId, responseFoodsList, `AI Keywords: ${aiKeywordsString}`);

        // 6. 결과 반환
        return res.status(200).json({
            success: true,
            foods: responseFoodsList
        });

    } catch (error) {
        console.error("recommendFoodsByAI 에러:", error);
        return res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
    }
};
