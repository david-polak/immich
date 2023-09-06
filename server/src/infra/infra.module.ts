import {
  IAccessRepository,
  IAlbumRepository,
  IAssetRepository,
  IAuditRepository,
  ICommunicationRepository,
  ICryptoRepository,
  IFaceRepository,
  IGeocodingRepository,
  IJobRepository,
  IKeyRepository,
  IMachineLearningRepository,
  IMediaRepository,
  immichAppConfig,
  IPartnerRepository,
  IPersonRepository,
  ISearchRepository,
  ISharedLinkRepository,
  ISmartInfoRepository,
  IStorageRepository,
  ISystemConfigRepository,
  ITagRepository,
  IUserRepository,
  IUserTokenRepository,
} from '@app/domain';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationGateway } from './communication.gateway';
import { databaseConfig } from './database.config';
import { databaseEntities } from './entities';
import { bullConfig, bullQueues } from './infra.config';
import {
  AccessRepository,
  AlbumRepository,
  APIKeyRepository,
  AssetRepository,
  AuditRepository,
  CommunicationRepository,
  CryptoRepository,
  FaceRepository,
  FilesystemProvider,
  GeocodingRepository,
  JobRepository,
  MachineLearningRepository,
  MediaRepository,
  PartnerRepository,
  PersonRepository,
  S3Provider,
  SharedLinkRepository,
  SmartInfoRepository,
  SystemConfigRepository,
  TagRepository,
  TypesenseRepository,
  UserRepository,
  UserTokenRepository,
} from './repositories';

const providers: Provider[] = [
  { provide: IAccessRepository, useClass: AccessRepository },
  { provide: IAlbumRepository, useClass: AlbumRepository },
  { provide: IAssetRepository, useClass: AssetRepository },
  { provide: IAuditRepository, useClass: AuditRepository },
  { provide: ICommunicationRepository, useClass: CommunicationRepository },
  { provide: ICryptoRepository, useClass: CryptoRepository },
  { provide: IFaceRepository, useClass: FaceRepository },
  { provide: IGeocodingRepository, useClass: GeocodingRepository },
  { provide: IJobRepository, useClass: JobRepository },
  { provide: IKeyRepository, useClass: APIKeyRepository },
  { provide: IMachineLearningRepository, useClass: MachineLearningRepository },
  { provide: IPartnerRepository, useClass: PartnerRepository },
  { provide: IPersonRepository, useClass: PersonRepository },
  { provide: ISearchRepository, useClass: TypesenseRepository },
  { provide: ISharedLinkRepository, useClass: SharedLinkRepository },
  { provide: ISmartInfoRepository, useClass: SmartInfoRepository },
  { provide: IStorageRepository, useClass: S3Provider },
  { provide: ISystemConfigRepository, useClass: SystemConfigRepository },
  { provide: ITagRepository, useClass: TagRepository },
  { provide: IMediaRepository, useClass: MediaRepository },
  { provide: IUserRepository, useClass: UserRepository },
  { provide: IUserTokenRepository, useClass: UserTokenRepository },
];

@Global()
@Module({
  imports: [
    ConfigModule.forRoot(immichAppConfig),
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature(databaseEntities),
    BullModule.forRoot(bullConfig),
    BullModule.registerQueue(...bullQueues),
  ],
  providers: [...providers, CommunicationGateway],
  exports: [...providers, BullModule],
})
export class InfraModule {}
