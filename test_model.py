import argparse
import json

from transformers import pipeline

parser = argparse.ArgumentParser()
parser.add_argument("--name", required=True, help="Your full name for the screenshot")
args = parser.parse_args()

print(f"Student: {args.name} | ID: B04-0923-000043ma | d = 3", flush=True)
model_id = "distilbert/distilbert-base-cased-distilled-squad"
print(f"Exact model: {model_id}", flush=True)
qa = pipeline("question-answering", model=model_id, device=-1)
print(f"Model loaded on: {qa.device}", flush=True)
context = "Karachi is the largest city in Pakistan. Islamabad is the capital of Pakistan."
question = "What is the capital of Pakistan?"
print(f"Context: {context}", flush=True)
print(f"Question: {question}", flush=True)
print(json.dumps(qa(question=question, context=context), indent=2), flush=True)
