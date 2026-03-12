import OpenAI from 'openai';
import * as scanModel from '../models/scanModel.js';
import { refreshSummaryForMeal } from '../services/dailySummariesService.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROMPT = `이 이미지에 담긴 음식을 분석해서, 각 음식별로 영양정보와 이미지 내 위치를 JSON 배열로 반환해주세요.
반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.
[
  { "name": "음식명", "amount": 숫자, "bbox": { "x": 숫자, "y": 숫자, "w": 숫자, "h": 숫자 }, "calories": 숫자, "carbohydrate": 숫자, "protein": 숫자, "fat": 숫자, "sodium": 숫자, "sugars": 숫자 },
  ...
]
- name: 음식명 (한국어)
- amount: 분석 기준이 된 음식의 양 (g). 이미지에서 보이는 분량을 g 단위로 추정
- bbox: 이미지 내 해당 음식이 있는 영역. 이미지 전체를 100 기준으로 한 비율
  - x: 왼쪽 상단의 x 위치 (0~100)
  - y: 왼쪽 상단의 y 위치 (0~100)
  - w: 너비 (0~100)
  - h: 높이 (0~100)
- calories: 칼로리 (kcal)
- carbohydrate: 탄수화물 (g)
- protein: 단백질 (g)
- fat: 지방 (g)
- sodium: 나트륨 (mg)
- sugars: 당류 (g)
예상치를 합리적으로 추정해주세요. bbox는 각 음식/음료가 이미지에서 차지하는 대략적인 영역을 추정해주세요.`;

const REANALYZE_PROMPT = `사용자가 수정한 음식 목록과 그램수에 맞춰 각 음식의 영양정보를 재계산해주세요.
반드시 아래 형식의 JSON 배열만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.
[
  { "name": "음식명", "amount": 숫자, "calories": 숫자, "carbohydrate": 숫자, "protein": 숫자, "fat": 숫자, "sodium": 숫자, "sugars": 숫자 },
  ...
]
- name: 음식명 (입력과 동일하게)
- amount: 그램수 (입력과 동일하게)
- calories: 해당 그램수 기준 칼로리 (kcal)
- carbohydrate: 탄수화물 (g)
- protein: 단백질 (g)
- fat: 지방 (g)
- sodium: 나트륨 (mg)
- sugars: 당류 (g)
각 음식의 일반적인 영양밀도를 고려하여 주어진 그램수에 맞는 영양소를 추정해주세요.
입력된 음식 순서대로 JSON 배열을 반환해주세요.`;

/**
 * POST /api/scan/food/reanalyze - 수정된 음식량으로 AI 재분석
 * req.body: { foods: [{ name: string, amount: number }, ...] }
 */
export async function reanalyzeFood(req, res) {
  try {
    const { foods: inputFoods } = req.body || {};
    if (!Array.isArray(inputFoods) || inputFoods.length === 0) {
      return res.status(400).json({
        message: 'foods 배열을 보내주세요. 예: { "foods": [{ "name": "김치찌개", "amount": 300 }] }',
      });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: 'OPENAI_API_KEY가 설정되지 않았습니다. .env를 확인해주세요.',
      });
    }

    const foodListStr = inputFoods
      .map((f) => `- ${String(f.name || '').trim() || '음식'}: ${Number(f.amount) || 0}g`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `${REANALYZE_PROMPT}\n\n수정된 음식 목록:\n${foodListStr}`,
        },
      ],
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    let foods = [];
    try {
      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      foods = JSON.parse(jsonStr);
    } catch (e) {
      console.error('AI 재분석 응답 파싱 실패:', text);
      return res
        .status(500)
        .json({ message: 'AI 재분석 결과를 파싱할 수 없습니다.', raw: text });
    }

    if (!Array.isArray(foods)) foods = [];
    const totalCalories = foods.reduce(
      (sum, f) => sum + (Number(f.calories) || 0),
      0
    );

    res.json({
      success: true,
      foods,
      totalCalories: Math.round(totalCalories),
    });
  } catch (err) {
    console.error(err);
    const msg = err?.message || '서버 오류';
    if (msg.includes('API key')) {
      return res.status(401).json({ message: 'OpenAI API 키가 유효하지 않습니다.' });
    }
    res.status(500).json({ message: msg });
  }
}

/**
 * POST /api/scan/food - 식사 사진 업로드 → AI 영양 분석
 * req.file: multer로 수신한 이미지 (buffer)
 */
export async function analyzeFood(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일을 업로드해주세요.' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: 'OPENAI_API_KEY가 설정되지 않았습니다. .env를 확인해주세요.',
      });
    }

    const imageUrl = req.file.location; // S3 버킷에 저장된 결과 URL

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '[]';
    let foods = [];
    try {
      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      foods = JSON.parse(jsonStr);
    } catch (e) {
      console.error('AI 응답 파싱 실패:', text);
      return res
        .status(500)
        .json({ message: 'AI 분석 결과를 파싱할 수 없습니다.', raw: text });
    }

    if (!Array.isArray(foods)) foods = [];
    const totalCalories = foods.reduce(
      (sum, f) => sum + (Number(f.calories) || 0),
      0
    );

    res.json({
      success: true,
      imageUrl: imageUrl, // 업로드된 S3 이미지 URL도 프론트에 반환
      foods,
      totalCalories: Math.round(totalCalories),
    });
  } catch (err) {
    console.error(err);
    const msg = err?.message || '서버 오류';
    if (msg.includes('API key')) {
      return res.status(401).json({ message: 'OpenAI API 키가 유효하지 않습니다.' });
    }
    res.status(500).json({ message: msg });
  }
}

/**
 * POST /api/scan/save-ai - AI 분석 결과 저장 (ai_scans)
 * FormData: image(파일), user_id, scan_result(JSON 문자열)
 * 이미지는 S3에 저장되고 DB에는 S3 URL 전체가 저장
 */
export async function saveAi(req, res) {
  try {
    const userId = req.body.user_id || req.user?.id;
    const { scan_result } = req.body;

    const missingFields = [];
    if (!userId) missingFields.push('user_id');
    if (!scan_result) missingFields.push('scan_result');

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `필수 데이터(${missingFields.join(', ')})가 누락되었습니다.`,
        received: { user_id: userId, scan_result_exists: !!scan_result }
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '이미지 파일(image)이 필요합니다.' });
    }

    const imageUrl = req.file.location;
    const scanResultObj = typeof scan_result === 'string' ? JSON.parse(scan_result) : scan_result;
    
    const saved = await scanModel.saveAiScanData(userId, imageUrl, scanResultObj);

    res.json({
      success: true,
      message: '저장되었습니다.',
      data: {
        scan_result: saved.scan_result,
        ai_scan_id: saved.id
      }
    });
  } catch (error) {
    console.error('saveAi 에러:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

/**
 * POST /api/scan/save-diary - 식단 기록 저장 (diary_entries)
 * Smart version: 이미지 하나만 보내도 분석부터 저장까지 자동 처리
 */
export async function saveDiary(req, res) {
  try {
    const userId = req.body.user_id || req.user?.id;
    let { ai_scan_id, meal_type, mealTime, image_url, scan_result } = req.body;
    let foods = req.body.foods;

    if (!userId) {
      return res.status(401).json({ success: false, message: '사용자 인증이 필요합니다.' });
    }

    // 1. 이미지가 업로드되었는데 foods(식단 정보)가 없으면 직접 AI 분석 실행
    let finalImageUrl = req.file ? req.file.location : image_url;
    let finalAiScanId = ai_scan_id;

    if (req.file && !scan_result && (!foods || (Array.isArray(foods) && foods.length === 0) || foods === '[]')) {
      console.log('이미지만 전송됨: AI 자동 분석 시작...');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: finalImageUrl } },
            ],
          },
        ],
        max_tokens: 1024,
      });

      const text = completion.choices[0]?.message?.content?.trim() || '[]';
      try {
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        foods = JSON.parse(jsonStr);

        // AI 스캔 이력도 자동으로 남김
        const savedScan = await scanModel.saveAiScanData(userId, finalImageUrl, foods);
        finalAiScanId = savedScan.id;
      } catch (e) {
        console.error('AI 자동 분석 실패:', text);
        return res.status(500).json({ success: false, message: 'AI 분석 결과를 생성할 수 없습니다.' });
      }
    }

    // 2. scan_result가 전송된 경우 (프론트 saveAiScan 호출) - ai_scans에 저장하고 ai_scan_id 생성
    if (scan_result && !finalAiScanId && req.file) {
      try {
        const scanResultObj = typeof scan_result === 'string' ? JSON.parse(scan_result) : scan_result;
        const savedScan = await scanModel.saveAiScanData(userId, finalImageUrl, scanResultObj);
        finalAiScanId = savedScan.id;
        console.log('scan_result로 ai_scans 저장 완료, ai_scan_id:', finalAiScanId);

        // scan_result만 보낸 경우 (foods 없음) - ai_scans 저장만 하고 바로 응답
        if (!foods || foods === '[]' || (Array.isArray(foods) && foods.length === 0)) {
          return res.json({
            success: true,
            message: 'AI 스캔 결과가 저장되었습니다.',
            ai_scan_id: finalAiScanId,
            data: {
              ai_scan_id: finalAiScanId,
              image_url: finalImageUrl
            }
          });
        }
      } catch (e) {
        console.error('scan_result 저장 실패:', e);
      }
    }

    // foods 파싱 (문자열로 올 경우)
    if (typeof foods === 'string') {
      try {
        foods = JSON.parse(foods);
      } catch(e) {
        return res.status(400).json({ success: false, message: 'foods 형식이 올바르지 않습니다.' });
      }
    }

    if (!foods || !Array.isArray(foods) || foods.length === 0) {
      return res.status(400).json({ success: false, message: '저장할 음식 정보(foods)가 없습니다.' });
    }

    // 2. meal_type이 없으면 현재 시간 기준으로 자동 설정
    if (!meal_type) {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 10) meal_type = 'breakfast';
      else if (hour >= 11 && hour < 15) meal_type = 'lunch';
      else if (hour >= 17 && hour < 21) meal_type = 'dinner';
      else meal_type = 'snack';
    }

    // 만약 프론트에서 image_url을 보내지 않고 ai_scan_id만 넘겼다면 DB에서 조회해서 사용
    if (finalAiScanId && !finalImageUrl) {
      const scanData = await scanModel.getAiScanById(finalAiScanId);
      if (scanData) {
        finalImageUrl = scanData.image_url;
      }
    }

    // 프론트 형식(name, calories, carbohydrate...) → 모델 형식(snap_food_name, snap_calories...) 변환
    const mappedFoods = foods.map((f) => ({
      snap_food_name: f.name || f.snap_food_name,
      snap_calories: f.calories ?? f.snap_calories ?? 0,
      snap_carbohydrate: f.carbohydrate ?? f.snap_carbohydrate ?? 0,
      snap_protein: f.protein ?? f.snap_protein ?? 0,
      snap_fat: f.fat ?? f.snap_fat ?? 0,
      snap_sugars: f.sugars ?? f.snap_sugars ?? 0,
      serving_size: f.amount ?? f.serving_size ?? 0,
    }));

    const savedEntries = await scanModel.saveDiaryEntries({
      user_id: userId,
      ai_scan_id: finalAiScanId,
      meal_type,
      mealTime,
      foods: mappedFoods,
      image_url: finalImageUrl
    });

    refreshSummaryForMeal(userId, mealTime || (savedEntries[0]?.meal_time)).catch((err) =>
      console.error('daily_summaries 갱신 실패:', err.message)
    );

    res.json({
      success: true,
      message: '저장되었습니다.',
      ai_scan_id: finalAiScanId || null,
      data: {
        ai_scan_id: finalAiScanId || null,
        meal_type,
        mealTime: savedEntries.length > 0 ? savedEntries[0].meal_time : mealTime,
        foods: foods
      }
    });

  } catch (error) {
    console.error('saveDiary 에러:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
