import OpenAI from 'openai';
import { pool } from '../config/db.js'; // DB 연결 설정 임포트

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const FILTER_TAGS = ['고단백', '다이어트', '비건', '저탄수', '0kcal', '저당'];

// 1. 초기 음식 카드 랜덤하게 가져오기 - 페이지 진입 시 DB의 전체 음식 중 랜덤으로 6개를 추출합니다.
export async function getRandomFoods(req, res) {
  try {
    // PostgreSQL 기준 RANDOM() 함수를 사용하여 무작위 6개 추출
    const query = `
      SELECT id, name, tags, image_url AS image 
      FROM foods
      ORDER BY RANDOM() 
      LIMIT 6
    `;
    const result = await pool.query(query);

    res.json({
      success: true,
      foods: result.rows,
    });
  } catch (err) {
    console.error('랜덤 데이터 로드 실패:', err);
    res.status(500).json({
      success: false,
      message: '초기 식단 로드 중 오류가 발생했습니다.',
    });
  }
}

// * 2. AI 챗봇 추천 (DB 검색 연동) - AI가 추천한 메뉴명을 바탕으로 DB에서 실제 정보를 조회하여 반환합니다.
export async function getAiRecommendation(req, res) {
  try {
    const { messages, inputMessage } = req.body;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 전문 영양사입니다. 사용자의 요청에 맞춰 한국의 실제 식단을 추천하세요.
          
          [응답 규칙]
          1. 추천하는 메뉴 데이터는 반드시 답변 마지막에 [DATA]와 [/DATA] 태그로 감싸서 JSON 배열 형식으로 포함하세요.
          2. JSON 구조: [{"name": "음식명", "description": "설명", "tags": ["태그1"]}]
          3. tags는 반드시 다음 목록에서만 선택하세요: ${FILTER_TAGS.join(', ')}.
          4. 답변 본문에는 특수문자나 복잡한 기호를 피하고 친절하게 설명하세요.`,
        },
        ...messages.filter((m) => m.role !== 'system'),
        { role: 'user', content: inputMessage },
      ],
    });

    const fullResponse = completion.choices[0].message.content;
    const jsonMatch = fullResponse.match(/\[DATA\]([\s\S]*?)\[\/DATA\]/);
    const chatContent = fullResponse
      .replace(/\[DATA\]([\s\S]*?)\[\/DATA\]/, '')
      .trim();

    let extractedFoods = [];
    if (jsonMatch) {
      const rawFoods = JSON.parse(jsonMatch[1]);
      const foodNames = rawFoods.map((f) => f.name);

      // AI가 추천한 이름이 DB에 있는지 확인 (유사 검색)
      const dbQuery = `
        SELECT id, name, description, tags, image_url as image 
        FROM foods 
        WHERE name = ANY($1)
      `;
      const dbResult = await pool.query(dbQuery, [foodNames]);

      // DB에 없는 음식은 AI가 생성한 정보를 기반으로 임시 객체 생성
      extractedFoods = rawFoods.map((aiFood) => {
        const matchingDbFood = dbResult.rows.find(
          (dbFood) => dbFood.name === aiFood.name,
        );
        return (
          matchingDbFood || {
            ...aiFood,
            id: `temp-${Date.now()}-${Math.random()}`,
            image: 'https://via.placeholder.com/150',
          }
        );
      });
    }

    res.json({
      success: true,
      chatContent: chatContent || '요청하신 조건에 맞는 식단을 준비했습니다.',
      foods: extractedFoods,
    });
  } catch (err) {
    console.error('AI 추천 에러:', err);
    res.status(500).json({
      success: false,
      message: 'AI 추천 처리 중 오류가 발생했습니다.',
    });
  }
}

// 3. 즐겨찾기 상태를 DB에 저장 - 사용자의 즐겨찾기 상태에 따라 INSERT 또는 DELETE를 수행합니다.
export async function toggleFavorite(req, res) {
  try {
    const { foodId, isFavorite, userId } = req.body; // userId는 세션이나 토큰에서 가져오는 것을 권장

    if (isFavorite) {
      // 즐겨찾기 추가 (중복 방지 ON CONFLICT)
      await pool.query(
        'INSERT INTO favorites (user_id, food_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, foodId],
      );
    } else {
      // 즐겨찾기 삭제
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND food_id = $2',
        [userId, foodId],
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('즐겨찾기 저장 실패:', err);
    res.status(500).json({
      success: false,
      message: '즐겨찾기 상태를 업데이트하지 못했습니다.',
    });
  }
}
