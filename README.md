# Question answering app

A free CPU Streamlit app for CS4106, assigned digit 3. Student ID: B04-0923-000043ma.

Model: distilbert/distilbert-base-cased-distilled-squad. The app loads it through a cached question-answering pipeline and displays the extracted answer with its numerical model confidence score.

## Run locally

Use Python 3.11 or 3.12. Install requirements.txt, then run `python -m streamlit run app.py`. Enter your full name in the sidebar before capturing screenshots. Run `python test_model.py --name "YOUR FULL NAME"` for the standalone model test.

## Deploy for free

On Streamlit Community Cloud select this repository, branch main, and app.py. Select Python 3.11 or 3.12. No paid inference API, GPU, access token, or secrets are required.

The hf_space folder contains a free Static Hugging Face Space wrapper. Replace the Streamlit URL and name placeholders in index.html, then upload that folder's README.md and index.html to the Space root. The public Streamlit app is embedded using /?embed=true. Python and model inference run on Streamlit Community Cloud.

The model can produce an incorrect span even with a high score, especially when the context does not contain an answer. Always verify against the supporting passage.

---

## Receipt Ledger (mobile app)

The [`receipt-ledger/`](receipt-ledger/) folder contains a separate, fully offline Expo app that turns payment-receipt screenshots into a per-bank ledger. See [`receipt-ledger/README.md`](receipt-ledger/README.md).
