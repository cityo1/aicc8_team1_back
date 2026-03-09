import { pool } from '../config/db.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const getChatRecommendation = async (req, res) => {
  try {
    const { inputMessage, messages, userNutrients } = req.body;

    // 1. OpenAI: 다중 키워드 추출 (안정성을 위해 'foods' 키가 없을 경우 대비)
    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            '사용자의 질문에서 언급된 모든 음식명을 추출하여 JSON 배열 형태로 답하세요. 예: { "foods": ["닭가슴살", "고구마"] }.',
        },
        { role: 'user', content: inputMessage },
      ],
      response_format: { type: 'json_object' },
    });

    // JSON.parse 에러 방지를 위해 content가 없을 경우 빈 객체 처리
    const content = extractionResponse.choices[0].message.content;
    const { foods: keywords = [] } = JSON.parse(content || '{}');

    let foodData = [];
    if (keywords.length > 0) {
      // 2. DB 검색: ANY($1)를 사용하여 배열 내 키워드와 일치하는 데이터 조회
      // (주의: 정확히 일치하는 이름만 검색됩니다. "닭가슴살"과 "훈제 닭가슴살"은 다르게 인식됨)
      const dbResult = await pool.query(
        'SELECT id, name, calories, carbo, protein, fat, sugar FROM foods WHERE name = ANY($1)',
        [keywords],
      );
      foodData = dbResult.rows;
    }

    // 3. OpenAI: 사용자 영양 상태와 DB 데이터를 결합한 최종 식단 조언
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `당신은 전문 영양사입니다. 
          - 사용자의 현재 영양 상태: ${JSON.stringify(userNutrients)}
          - 검색된 음식 데이터: ${JSON.stringify(foodData)}
          
          위 데이터를 바탕으로 사용자의 질문에 답하세요. 만약 데이터베이스에 검색 결과가 없다면 일반적인 영양 지식을 바탕으로 조언하고, 검색 결과가 있다면 해당 수치(칼로리, 단백질 등)를 인용하여 적합성을 분석해 주세요.`,
        },
        ...messages, // 이전 대화 내용 유지
        { role: 'user', content: inputMessage },
      ],
    });

    res.status(200).json({
      reply: finalResponse.choices[0].message.content,
      foods: foodData, // 프론트엔드 UI(오른쪽 카드 섹션 등)에서 사용할 상세 정보
    });
  } catch (error) {
    console.error('Diet Recommend Error:', error);
    res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
  }
};
