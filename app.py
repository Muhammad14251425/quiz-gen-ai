import threading

import streamlit as st
from transformers import pipeline

STUDENT_ID = "B04-0923-000043ma"
STUDENT_NAME = "YOUR FULL NAME"  # Replace before screenshots.
MODEL_ID = "distilbert/distilbert-base-cased-distilled-squad"
SAMPLE_CONTEXT = (
    "Karachi is the largest city in Pakistan. "
    "Islamabad is the capital of Pakistan. "
    "The national language of Pakistan is Urdu."
)

st.set_page_config(page_title="CS4106 Question Answering", layout="wide")
name = st.sidebar.text_input("Student name", value=STUDENT_NAME).strip()
st.title(f"Question Answering | {name} | {STUDENT_ID}")
st.caption("CS4106 Quiz | d = 3 | Free local CPU inference")
st.caption(f"Model: {MODEL_ID}")


@st.cache_resource
def load_model():
    qa = pipeline("question-answering", model=MODEL_ID, device=-1)
    return qa, threading.Lock()


context = st.text_area("Context passage", value=SAMPLE_CONTEXT, height=150)
question = st.text_input("Question", value="What is the capital of Pakistan?")
st.caption("The model extracts an answer from your passage. Check the evidence.")

if st.button("Find answer", type="primary"):
    if not name or name == "YOUR FULL NAME":
        st.warning("Enter your full name in the sidebar before taking screenshots.")
        st.stop()
    context, question = context.strip(), question.strip()
    if not context or not question:
        st.warning("Please enter both a context passage and a question.")
        st.stop()
    if len(context) > 12000 or len(question) > 500:
        st.warning("Use at most 12,000 context characters and 500 question characters.")
        st.stop()
    try:
        with st.spinner("Loading the model and finding an answer..."):
            qa, lock = load_model()
            with lock:
                result = qa(question=question, context=context)
    except Exception as exc:
        st.error("Model loading or inference failed. Check the connection and packages.")
        st.code(str(exc))
        st.stop()

    score = float(result["score"])
    st.subheader("Answer")
    st.write(result["answer"])
    st.metric("Model confidence score", f"{score:.4f} ({score:.1%})")
    st.progress(min(1.0, max(0.0, score)))
    st.caption("This model score is not a verified probability that the answer is correct.")
    start, end = int(result["start"]), int(result["end"])
    st.write("Answer location in the context:")
    st.code(context[max(0, start - 70):min(len(context), end + 70)])
    if score < 0.35:
        st.warning("Low model confidence. Verify the answer against the passage.")
    st.caption("An answer can still be wrong when confidence is high.")
