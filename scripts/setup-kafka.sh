#!/bin/bash
set -euo pipefail

# Provision a single-node Apache Kafka (KRaft mode, no ZooKeeper) on the host,
# with data under /mnt/data/kafka. Target: the m720q homelab node. Idempotent.
#
# Java: Kafka officially tests against LTS 11/17/21. We default to JDK 21 (newest
# Kafka-supported LTS). JDK 25 is NOT validated by Kafka yet — override at your
# own risk with JRE_PKG=openjdk-25-jre-headless.
#
# Env overrides:
#   KAFKA_VERSION    (default 3.9.0)
#   SCALA            (default 2.13)
#   KAFKA_DATA       (default /mnt/data/kafka)
#   KAFKA_HEAP       (default "-Xmx1g -Xms1g")
#   ADVERTISED_HOST  (default m720q)  must be resolvable by in-cluster pods
#   JRE_PKG          (default openjdk-21-jre-headless)

KAFKA_VERSION=${KAFKA_VERSION:-3.9.0}
SCALA=${SCALA:-2.13}
KAFKA_DATA=${KAFKA_DATA:-/mnt/data/kafka}
KAFKA_HEAP=${KAFKA_HEAP:--Xmx1g -Xms1g}
ADVERTISED_HOST=${ADVERTISED_HOST:-m720q}
JRE_PKG=${JRE_PKG:-openjdk-21-jre-headless}
KAFKA_HOME=/opt/kafka

log() { printf "%s - %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }

# 1. JRE + service user.
log "Installing ${JRE_PKG}"
sudo apt-get install -y "$JRE_PKG"
id kafka >/dev/null 2>&1 || sudo useradd -r -m -d /opt/kafka-home -s /usr/sbin/nologin kafka

# 2. Download + extract (archive.apache.org keeps every release).
DIST="kafka_${SCALA}-${KAFKA_VERSION}"
if [ ! -d "/opt/${DIST}" ]; then
  log "Downloading ${DIST}"
  curl -fsSL -o "/tmp/${DIST}.tgz" \
    "https://archive.apache.org/dist/kafka/${KAFKA_VERSION}/${DIST}.tgz"
  sudo tar -xzf "/tmp/${DIST}.tgz" -C /opt
fi
sudo ln -sfn "/opt/${DIST}" "$KAFKA_HOME"

# 3. Data directory.
sudo mkdir -p "$KAFKA_DATA"

# 4. KRaft config (combined broker+controller single node).
CFG="$KAFKA_HOME/config/kraft/server.properties"
sudo sed -i \
  -e "s|^log.dirs=.*|log.dirs=${KAFKA_DATA}|" \
  -e "s|^listeners=.*|listeners=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093|" \
  -e "s|^advertised.listeners=.*|advertised.listeners=PLAINTEXT://${ADVERTISED_HOST}:9092|" \
  "$CFG"
# single-node replication safety (defaults are already 1, enforce anyway)
for kv in \
  "offsets.topic.replication.factor=1" \
  "transaction.state.log.replication.factor=1" \
  "transaction.state.log.min.isr=1"; do
  key=${kv%%=*}
  if grep -q "^${key}=" "$CFG"; then
    sudo sed -i "s|^${key}=.*|${kv}|" "$CFG"
  else
    echo "$kv" | sudo tee -a "$CFG" >/dev/null
  fi
done

# 5. Format KRaft storage once (meta.properties lands in log.dirs).
if [ ! -f "${KAFKA_DATA}/meta.properties" ]; then
  CID=$("$KAFKA_HOME/bin/kafka-storage.sh" random-uuid)
  log "Formatting KRaft storage (cluster id ${CID})"
  sudo "$KAFKA_HOME/bin/kafka-storage.sh" format -t "$CID" -c "$CFG"
fi

# 6. Ownership.
sudo chown -R kafka:kafka "$KAFKA_DATA" "/opt/${DIST}"

# 7. systemd unit.
sudo tee /etc/systemd/system/kafka.service >/dev/null <<EOF
[Unit]
Description=Apache Kafka (KRaft)
After=network-online.target
Wants=network-online.target

[Service]
User=kafka
Group=kafka
Environment="KAFKA_HEAP_OPTS=${KAFKA_HEAP}"
ExecStart=${KAFKA_HOME}/bin/kafka-server-start.sh ${CFG}
ExecStop=${KAFKA_HOME}/bin/kafka-server-stop.sh
Restart=on-failure
LimitNOFILE=100000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now kafka
log "Kafka started, advertising PLAINTEXT://${ADVERTISED_HOST}:9092"
