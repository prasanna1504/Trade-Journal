import asyncio
import json
from django.conf import settings
from google import genai

MODEL = 'gemini-2.5-flash-lite'

AGENTS = [
    {
        'id': 'pattern',
        'name': 'Pattern Detective',
        'icon': '🔍',
        'prompt': """You are a trading pattern analyst. Your job is to find hidden losing patterns in a trader's history.

Analyze the trades and journal entries below. Look for:
- Which symbols consistently lose money
- Which trade direction (BUY/SELL) is weaker
- Time-based patterns (if timestamps suggest certain sessions)
- Setup patterns that repeat before losses
- Win streaks vs loss streaks — what happens before a losing streak starts

Be specific with numbers. Reference actual trades. Keep your response under 200 words.
Format: Start with a bold one-line summary, then bullet points.

TRADE DATA:
{trade_data}""",
    },
    {
        'id': 'emotion',
        'name': 'Emotion Coach',
        'icon': '🧠',
        'prompt': """You are a trading psychology expert. Analyze this trader's emotional patterns.

Look at the emotion tags and journal notes. Find:
- Which emotions correlate with losing trades (with exact numbers)
- Which emotions correlate with winning trades
- Whether the trader's written notes reveal hidden emotional biases
- Signs of revenge trading, FOMO, or overconfidence in the journal notes
- The emotional state that leads to their best trades

Be brutally honest but constructive. Under 200 words.
Format: Start with a bold one-line summary, then bullet points.

TRADE DATA:
{trade_data}""",
    },
    {
        'id': 'mistakes',
        'name': 'Mistake Auditor',
        'icon': '⚠️',
        'prompt': """You are a trading mistake analyst. Your job is to quantify how much each recurring mistake costs this trader.

Analyze the mistake tags and notes. Find:
- Which mistakes appear most frequently
- The total P&L cost of each mistake type
- Whether certain mistakes cluster together (e.g. FOMO entry → early exit)
- The single most expensive habit to break
- One concrete rule the trader should add to their playbook to eliminate the costliest mistake

Be direct. Show the math. Under 200 words.
Format: Start with a bold one-line summary, then bullet points.

TRADE DATA:
{trade_data}""",
    },
    {
        'id': 'risk',
        'name': 'Risk Analyst',
        'icon': '📊',
        'prompt': """You are a risk management expert. Analyze this trader's position sizing and risk discipline.

Look at volume, profit/loss ratios, and trade outcomes. Find:
- Whether the trader sizes up on losing trades (averaging down behavior)
- The average win vs average loss — is the R:R positive?
- Whether big losses come from oversized positions
- Consistency of position sizing — do they stick to a lot size or is it random?
- One specific risk rule they should implement immediately

Be quantitative. Under 200 words.
Format: Start with a bold one-line summary, then bullet points.

TRADE DATA:
{trade_data}""",
    },
    {
        'id': 'strategy',
        'name': 'Strategy Analyst',
        'icon': '🎯',
        'prompt': """You are a trading strategy performance analyst. Your job is to break down which strategies work and which don't.

Analyze the trades and journal entries below. Look for:
- Win rate per strategy tag (if tagged) — which strategy has the highest win rate?
- If no strategy tags, infer strategies from journal notes and trade behavior (e.g. scalps vs swing trades based on hold time, breakout vs reversal based on notes)
- Which confirmations mentioned in journal notes correlate with winning trades?
- Which market conditions or setups mentioned in notes lead to losses?
- Best time of day / session for each strategy
- Symbols where each strategy performs best vs worst
- Recommended: which strategy should the trader focus on and which should they drop?

Be specific with percentages and trade counts. Under 250 words.
Format: Start with a bold one-line summary, then break down by strategy/setup.

TRADE DATA:
{trade_data}""",
    },
    {
        'id': 'coach',
        'name': 'Head Coach',
        'icon': '🏆',
        'prompt': """You are a senior trading coach with 20 years of experience. You have reviewed this trader's complete history, emotions, mistakes, and risk habits.

Give them your honest overall assessment:
- What is this trader's biggest single weakness right now?
- What are they already doing well (be specific)?
- The top 3 actionable changes they must make THIS WEEK, ranked by impact
- One mindset shift that would transform their trading

Write like you're speaking directly to them. Be tough but encouraging. Under 250 words.
Format: Start with a bold one-line verdict, then sections for Strengths / Changes / Mindset.

TRADE DATA:
{trade_data}""",
    },
]


def build_trade_summary(trades, journal_entries) -> str:
    journal_map = {je['trade']: je for je in journal_entries}

    lines = []
    for t in trades:
        j = journal_map.get(t['id'], {})
        line = {
            'symbol': t['symbol'],
            'type': t['trade_type'],
            'volume': float(t['volume']),
            'open_price': float(t['open_price']),
            'close_price': float(t['close_price']) if t['close_price'] else None,
            'open_time': str(t['open_time']),
            'close_time': str(t['close_time']) if t['close_time'] else None,
            'profit': float(t['profit']) if t['profit'] is not None else None,
            'strategy': t.get('strategy_tag', ''),
            'emotion': j.get('emotion', ''),
            'mistake': j.get('mistake', ''),
            'rating': j.get('rating', ''),
            'notes': j.get('notes', ''),
        }
        lines.append(line)

    return json.dumps(lines, indent=2)


async def run_agent(client, agent: dict, trade_summary: str) -> dict:
    prompt = agent['prompt'].format(trade_data=trade_summary)
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL,
            contents=prompt,
        )
        return {
            'id': agent['id'],
            'name': agent['name'],
            'icon': agent['icon'],
            'result': response.text,
            'error': None,
        }
    except Exception as e:
        return {
            'id': agent['id'],
            'name': agent['name'],
            'icon': agent['icon'],
            'result': None,
            'error': str(e),
        }


async def run_all_agents(trades: list, journal_entries: list) -> list:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    trade_summary = build_trade_summary(trades, journal_entries)

    tasks = [run_agent(client, agent, trade_summary) for agent in AGENTS]
    results = await asyncio.gather(*tasks)
    return list(results)


def analyse_trades(trades: list, journal_entries: list) -> list:
    return asyncio.run(run_all_agents(trades, journal_entries))


AUTO_JOURNAL_PROMPT = """You are an expert trading psychologist and journal writer.

For each trade below, generate a journal entry. Base your analysis on:
- Symbol, direction (BUY/SELL), profit/loss, volume, hold duration
- Any existing notes or tags already present
- Common trading psychology patterns

Return a valid JSON array ONLY — no markdown, no explanation, just the raw JSON array.
Each object must have exactly these fields:
{{
  "trade_id": <integer>,
  "notes": "<2-3 sentence journal note describing what likely happened, why, and the lesson>",
  "emotion": "<one of: disciplined, fomo, revenge, patient, greedy, fearful, confident>",
  "mistake": "<one of: none, early_exit, late_exit, oversized, no_plan, moved_sl, chased>",
  "rating": <integer 1-5>
}}

TRADES:
{trade_data}"""


async def auto_journal_trades_async(trades: list) -> list:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    trade_summary = json.dumps([{
        'trade_id': t['id'],
        'symbol': t['symbol'],
        'type': t['trade_type'],
        'volume': float(t['volume']),
        'open_price': float(t['open_price']),
        'close_price': float(t['close_price']) if t['close_price'] else None,
        'open_time': str(t['open_time']),
        'close_time': str(t['close_time']) if t['close_time'] else None,
        'profit': float(t['profit']) if t['profit'] is not None else None,
        'strategy': t.get('strategy_tag', ''),
    } for t in trades], indent=2)

    prompt = AUTO_JOURNAL_PROMPT.format(trade_data=trade_summary)

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=MODEL,
        contents=prompt,
    )

    text = response.text.strip()
    # Strip markdown code fences if present
    if text.startswith('```'):
        text = text.split('```')[1]
        if text.startswith('json'):
            text = text[4:]
    text = text.strip()

    return json.loads(text)


def auto_journal_trades(trades: list) -> list:
    return asyncio.run(auto_journal_trades_async(trades))
