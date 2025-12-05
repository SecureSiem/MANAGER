const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'topic-checker',
  brokers: ['192.168.1.139:29092'],
});

async function checkKafkaTopics() {
  const admin = kafka.admin();
  
  try {
    await admin.connect();
    console.log('Connected to Kafka successfully!');
    
    const metadata = await admin.fetchTopicMetadata({
      topics: ['security-logs']
    });
    
    console.log('\n=== KAFKA TOPIC DETAILS ===');
    console.log('Topic:', metadata.topics[0].name);
    console.log('Partitions:', metadata.topics[0].partitions.length);
    console.log('Partition Details:');
    
    metadata.topics[0].partitions.forEach((partition, index) => {
      console.log(`  Partition ${partition.partitionId}: Leader=${partition.leader}, Replicas=${partition.replicas.length}`);
    });
    
    const allTopics = await admin.listTopics();
    console.log('\n=== ALL TOPICS ===');
    console.log('Available topics:', allTopics);
    
  } catch (error) {
    console.error('Error checking Kafka:', error);
  } finally {
    await admin.disconnect();
  }
}

checkKafkaTopics();