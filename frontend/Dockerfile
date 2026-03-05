FROM node:20-alpine AS build
WORKDIR /app

ARG REACT_APP_API_URL=http://localhost:3001
ARG REACT_APP_POWERBI_EMBED_URL=
ARG REACT_APP_POWERBI_REPORT_ID=
ARG REACT_APP_POWERBI_GROUP_ID=

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_POWERBI_EMBED_URL=$REACT_APP_POWERBI_EMBED_URL
ENV REACT_APP_POWERBI_REPORT_ID=$REACT_APP_POWERBI_REPORT_ID
ENV REACT_APP_POWERBI_GROUP_ID=$REACT_APP_POWERBI_GROUP_ID

COPY package.json ./
RUN npm install
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
