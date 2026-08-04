"""MindBuddy exercise catalogue — 100 guided exercises in 5 categories.

Every exercise is TTS-friendly, needs no equipment, can be done sitting or
lying down (the single walking exercise is marked), and runs 1-10 minutes.

The same catalogue is used by:
    * the TFT exercise page (category selection -> `exercise_set`)
    * `main.py` (the `start_exercise` LLM action)
    * `prompts.py` (so the model only ever names exercises we actually ship)
"""
from __future__ import annotations

import random
from typing import Dict, List

BREATHING: List[str] = [
    "Box Breathing — inhale 4, hold 4, exhale 4, hold 4",
    "4-7-8 Breathing — inhale 4, hold 7, exhale 8",
    "Diaphragmatic (belly) Breathing",
    "Pursed-Lip Breathing",
    "Equal Breathing (Sama Vritti) — inhale 5, exhale 5",
    "Alternate Nostril Breathing (Nadi Shodhana)",
    "Coherent Breathing — five breaths a minute",
    "Extended Exhale Breathing — exhale twice as long as the inhale",
    "Sighing Breath — double inhale, long release",
    "Counted Breathing to Ten",
    "Ocean Breath (Ujjayi)",
    "Cooling Breath (Sitali)",
    "Humming Bee Breath (Bhramari)",
    "Resonant Breathing with a Hand on the Chest",
    "Three-Part Breath (belly, ribs, chest)",
    "Breath Awareness — simply watching the breath",
    "Slow Nasal Breathing for Panic",
    "Breath Counting Backwards from Twenty",
    "Anchor Breathing — one word on the inhale, one on the exhale",
    "Recovery Breathing After a Panic Wave",
]

MINDFULNESS: List[str] = [
    "Body Scan Meditation",
    "Five Senses Grounding (5-4-3-2-1)",
    "Mindful Breathing Meditation",
    "Loving-Kindness Meditation (Metta)",
    "Open Awareness Meditation",
    "Noting Thoughts — labelling thinking, feeling, hearing",
    "Sound Awareness Meditation",
    "Mindful Hand Awareness",
    "Leaves on a Stream Visualisation",
    "Mountain Meditation",
    "Candle-Flame Focus (imagined)",
    "Mindful Listening to the Room",
    "Compassionate Self-Talk Meditation",
    "Gratitude Meditation",
    "Mindful Walking (the one exercise that needs standing)",
    "Breath-Counting Concentration Practice",
    "Present-Moment Check-In",
    "Non-Judgemental Observation of Feelings",
    "Mindful Eating of One Small Bite",
    "Three-Minute Breathing Space",
]

STRESS: List[str] = [
    "Progressive Muscle Relaxation (full body)",
    "Quick Tension Release — shoulders, jaw, hands",
    "Grounding Through the Feet",
    "Safe Place Visualisation",
    "Worry Time — parking worries for later",
    "Thought Download — naming every worry out loud",
    "Cold Water Face Splash (dive reflex)",
    "Hand-on-Heart Self-Soothing",
    "Butterfly Hug (bilateral tapping)",
    "Counting Objects in the Room",
    "Naming Colours Around You",
    "Physiological Sigh",
    "Muscle Squeeze and Release for Hands",
    "Jaw and Face Softening",
    "Neck and Shoulder Roll (seated)",
    "Anxiety Wave Surfing — riding the peak",
    "Grounding With a Held Object",
    "Reality Check for Racing Thoughts",
    "Reassurance Script for Panic",
    "Slow Body Rocking",
]

POSITIVE: List[str] = [
    "Three Good Things",
    "Gratitude Letter (spoken)",
    "Strengths Inventory",
    "Reframing a Negative Thought",
    "Best Possible Self Visualisation",
    "Self-Compassion Break",
    "Positive Affirmations Repetition",
    "Small Win Recognition",
    "Kindness Recall — a time someone was kind",
    "Future Letter to Yourself",
    "Values Check-In",
    "Naming One Thing You Did Well Today",
    "Compliment Yourself Out Loud",
    "Evidence For and Against a Harsh Thought",
    "Hope List — what you're looking forward to",
    "Forgiveness Reflection",
    "Savouring a Good Memory",
    "Acts of Kindness Planning",
    "Confidence Anchor Recall",
    "Letting Go of a Comparison",
]

SLEEP: List[str] = [
    "Bedtime Body Scan",
    "Military Sleep Method",
    "Guided Sleep Visualisation — a quiet beach",
    "Counting Down From One Hundred",
    "Sleep-Ready Progressive Muscle Relaxation",
    "Slow Breathing for Sleep — 4 in, 6 out",
    "Brain Dump Before Bed",
    "Gratitude Before Sleep",
    "Wind-Down Routine Rehearsal",
    "Warm Heaviness Visualisation (autogenic)",
    "Relaxing the Face for Sleep",
    "Imagining a Safe, Quiet Room",
    "Cognitive Shuffle — random harmless words",
    "Naming Calm Words Alphabetically",
    "Releasing the Day",
    "Slow Blink and Eye Rest",
    "Soft Belly Breathing Lying Down",
    "Night-Waking Reset",
    "Morning Recovery Stretch (seated)",
    "Nap Reset — a ten-minute rest script",
]

CATEGORIES: Dict[str, List[str]] = {
    "BREATHING": BREATHING,
    "MINDFULNESS": MINDFULNESS,
    "STRESS": STRESS,
    "POSITIVE": POSITIVE,
    "SLEEP": SLEEP,
}

CATEGORY_LABELS: Dict[str, str] = {
    "BREATHING": "Breathing Exercises",
    "MINDFULNESS": "Mindfulness & Meditation",
    "STRESS": "Stress & Anxiety Relief",
    "POSITIVE": "Positive Thinking & Emotional Wellness",
    "SLEEP": "Sleep & Recovery",
    "RANDOM": "Random Exercise",
}

ALL: List[str] = [e for items in CATEGORIES.values() for e in items]


def normalise(category: str) -> str:
    c = (category or "RANDOM").strip().upper()
    return c if c in CATEGORIES or c == "RANDOM" else "RANDOM"


def pick(category: str = "RANDOM") -> tuple[str, str]:
    """Return (category, exercise-name) for a category (or a random one)."""
    c = normalise(category)
    if c == "RANDOM":
        c = random.choice(list(CATEGORIES))
    return c, random.choice(CATEGORIES[c])


def catalogue_text(per_category: int = 20) -> str:
    """Compact catalogue for the LLM system prompt."""
    out = []
    for key, items in CATEGORIES.items():
        out.append(f"{CATEGORY_LABELS[key]} ({key}): " +
                   "; ".join(items[:per_category]))
    return "\n".join(out)


def guide_prompt(category: str, name: str, mode: str = "") -> str:
    """Internal prompt asking the LLM to narrate one exercise."""
    return (
        f"INTERNAL EVENT: the user started the exercise '{name}' from the "
        f"{CATEGORY_LABELS.get(category, category)} category"
        + (f" while in {mode} mode" if mode else "")
        + ". Guide them through it out loud, step by step, in 1 to 5 minutes "
          "of speech. Use short sentences, gentle pacing and pauses. They may "
          "be sitting or lying down and have no equipment. End by asking how "
          "they feel. Plain spoken reply only — no lists, no headings."
    )
