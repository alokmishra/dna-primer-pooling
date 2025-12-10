FROM python:3.9

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /code

RUN python -m venv .venv
COPY ./requirements.txt /code/requirements.txt
RUN .venv/bin/pip install --no-cache-dir --upgrade -r code/requirements.txt
COPY ./api /code/api


CMD ["fastapi", "run", "api/fapi.py", "--port", "80"]
