import { v4 as uuidv4 } from 'uuid';

import * as user from '../models/user';
import * as genericModel from '../models/genericModel';
import * as employeeSkill from '../models/employeeSkill';
import * as employeeStatus from '../models/employeeStatus';
import * as employeeDesignationArea from '../models/employeeDesignationArea';

import { sendMail } from '../services/mail';
import * as employeeSkillService from '../services/employeeSkill';
import * as employeeStatusService from '../services/employeeStatus';
import * as employeeDesignationAreaService from '../services/employeeDesignationArea';

import { http } from '../utils/http';
import logger from '../utils/logger';
import { stripYear } from '../utils/time';
import * as pagination from '../utils/pagination';
import { uploadToS3 } from '../utils/uploadFileToS3';
import { supervisorChangeMail } from '../utils/emailTemplate';
import { convertToPNG, resizeImage } from '../utils/resizeImage';
import { checkDuplicateKey, extractCreateUpdateDelete, withOnlyAttrs } from '../utils/object';

import { UPDATABLE_FIELDS } from '../constants/updatableFields';
import { userCreateFields, usersUpdateFields } from '../constants/userFields';

import AuthUser from '../domains/common/AuthUser';

import BadRequest from '../errors/BadRequest';

import User from '../domains/User';
import Skill from '../domains/Skill';
import Query from '../domains/Query';
import Mapping from '../domains/Mapping';
import RoleMap from '../domains/RoleMap';
import LeaveIssuer from '../domains/LeaveIssuer';
import EmployeeSkill from '../domains/EmployeeSkill';
import EmployeeStatus from '../domains/EmployeeStatus';
import EmployeeDesignationArea from '../domains/EmployeeDesignationArea';

import config from '../config/config';

const modelName = 'user';

const filter: Mapping<boolean> = {};
const roleMap: RoleMap = {
  accountManager: 'user.isAccountManager',
  hr: 'user.isHr',
  peopleOps: 'user.isPeopleOps'
};

/**
 * Service to fetch all users.
 *
 * @param {Query} query
 * @returns {Promise}
 */
export async function fetch(query: Query) {
  const { q, role, page, size, empStatus, supervisorId, isSupervisor, email } = query;
  const limit = pagination.limit(size);
  const offset = pagination.offset(page, limit);
  const filter = {} as Mapping<any>;
  const terminated = query.terminated && query.terminated.toLowerCase() === 'true' ? true : false;

  if (role) {
    const roles = role.map((key: any) => roleMap[key]);
    roles.forEach((key: string) => (filter[key] = true));
  }

  if (supervisorId) {
    filter['user.supervisorId'] = supervisorId;
  }

  if (isSupervisor) {
    filter['user.isSupervisor'] = query.isSupervisor ? true : false;
  }
  
  if (email) {
    filter['user.username'] = email;
  }

  const data = await user.fetch(q, filter, empStatus, offset, limit, terminated);
  data.map(singleData => {
    singleData.birthday = stripYear(new Date(singleData.birthday));
  });

  return data;
}

/**
 * Service to fetch user by Id.
 *
 * @param {number} id
 * @returns {Promise}
 */
export async function fetchById(id: number, currentUser?: AuthUser) {
  const userPromise = user.fetchById(id);
  const employeeStatusPromise = employeeStatus.fetchByUserId(id);
  const skillPromise = employeeSkill.fetchById(id);
  const designationAreasPromise = employeeDesignationArea.fetchByEmployeeId(id);
  const [[data], skills, empStatusHistory, designationAreas] = await Promise.all([
    userPromise,
    skillPromise,
    employeeStatusPromise,
    designationAreasPromise
  ]);

  if (!data) {
    logger.error('User Not Found');
    throw new BadRequest('User Not Found', 'Invalid id', 400);
  }
  data.skills = skills;

  const empStatusHistoryModel = empStatusHistory.map(esh => {
    return {
      id: esh.id,
      transitionDate: esh.transitionDate,
      engagementStatus: esh.engagementStatus,
      endDate: esh.endDate ? esh.endDate : null
    };
  });

  const designationAreaHistoryModel = designationAreas.map(designationArea => {
    return {
      id: designationArea.id,
      transitionDate: designationArea.transitionDate,
      area: designationArea.area.id ? designationArea.area : null,
      designation: designationArea.designation
    };
  });

  if (canViewEmployeeHistory(currentUser, id)) {
    data.empStatusHistory = empStatusHistoryModel;
    data.designationAreaHistory = designationAreaHistoryModel;
  }

  if (!canViewEmployeeCV(currentUser, id)) {
    delete data['cvUrl'];
  }

  data.empStatus = empStatusHistoryModel && empStatusHistoryModel[empStatusHistoryModel.length - 1];
  data.designationArea =
    designationAreaHistoryModel && designationAreaHistoryModel[designationAreaHistoryModel.length - 1];

  data.birthday = stripYear(new Date(data.birthday));

  return data;
}

/**
 * Service to fetch total count.
 *
 * @param {Query} query
 * @returns {number}
 */
export async function count(query: Query) {
  const { q, role, empStatus, supervisorId } = query;
  const filter = {} as Mapping<any>;
  const terminated = query.terminated && query.terminated.toLowerCase() === 'true' ? true : false;

  if (role) {
    const roles = role.map((key: any) => roleMap[key]);
    roles.forEach((key: string) => (filter[key] = true));
  }

  if (supervisorId) {
    filter['user.supervisorId'] = supervisorId;
  }

  const count = await user.count(q, filter, empStatus, terminated);

  return count;
}

/**
 * Fetch users from auth server from token.
 *
 * @param {String} token
 * @throws NetworkError
 */
export function fetchUserByToken(token: string) {
  return http
    .get(`${config.auth.baseUrl}/userinfo`, {
      headers: {
        accessToken: token,
        clientId: config.auth.clientId
      }
    })
    .then(response => response.data);
}

/**
 * Service to create user.
 *
 * @param {User} payload
 * @param {AuthUser} currentUser
 */
export async function create(payload: User, currentUser?: AuthUser) {
  const user = withOnlyAttrs(payload, userCreateFields);

  const uniqueFields = {
    empId: payload.empId,
    username: payload.username
  };

  const duplicateEntry = await checkDuplicateUser(uniqueFields);
  if (duplicateEntry.length > 0) {
    const details = checkDuplicateKey(duplicateEntry[0], uniqueFields);
    logger.error(`Duplicate keys: ${details}`);
    throw new BadRequest(`${details} already exists`, `Duplicate Keys: ${details}`, 400);
  }

  const id = await genericModel.create(modelName, user);
  const newUser = {
    id: Number(id[0])
  };

  const createSkills = getSkillsCreatePromises(payload, newUser, currentUser);
  const createDesignationAreas = getDesignationAreaCreatePromises(payload, newUser, currentUser);
  const createEmpStatusHistory = getEmployeeStatusHistoryCreatePromises(payload, newUser, currentUser);

  await Promise.all([...createSkills, ...createDesignationAreas, ...createEmpStatusHistory]);

  const createdUser = await fetchById(Number(newUser.id), currentUser);

  return createdUser;
}

/**
 * Function that return promises toCreateEmployeeStausHistory.
 *
 * @param {any} payload
 * @param {any} newUser
 * @param {AuthUser} currentUser
 * @returns {Promises[]}
 */
function getSkillsCreatePromises(payload: any, newUser: any, currentUser?: AuthUser) {
  const createEmployeeSkillPromises = payload.skills.map(skill => {
    const employeeSkillObject: EmployeeSkill = {
      employeeSkillsId: newUser.id,
      skillId: skill.id
    };
    employeeSkillService.create(employeeSkillObject, currentUser);
  });

  return createEmployeeSkillPromises;
}

/**
 * Function that return promises toCreateEmployeeStausHistory.
 *
 * @param {any} payload
 * @param {any} newUser
 * @param {AuthUser} currentUser
 * @returns {Promises[]}
 */
function getEmployeeStatusHistoryCreatePromises(payload: any, newUser: any, currentUser: AuthUser | undefined) {
  const empStatusHistory = payload.empStatusHistory.map(esh => {
    return {
      userId: newUser.id,
      engagementStatusId: esh.engagementStatus.id,
      transitionDate: esh.transitionDate
    };
  });

  const createEmpStatusHistory = empStatusHistory.map(empStatusHistory =>
    employeeStatusService.create(empStatusHistory, currentUser)
  );

  return createEmpStatusHistory;
}

/**
 * Function that return promises toCreateDesignationArea.
 *
 * @param {any} payload
 * @param {any} newUser
 * @param {AuthUser} currentUser
 * @returns {Promises[]}
 */
function getDesignationAreaCreatePromises(payload: any, newUser: any, currentUser: AuthUser | undefined) {
  const employeeDesignationAreas = payload.designationAreaHistory.map(eda => {
    return {
      userId: newUser.id,
      areaId: eda.area ? eda.area.id : null,
      designationId: eda.designation.id,
      transitionDate: eda.transitionDate
    };
  });

  const createDesignationAreas = employeeDesignationAreas.map(designationArea =>
    employeeDesignationAreaService.create(designationArea, currentUser)
  );

  return createDesignationAreas;
}

/**
 * Service to update user.
 *
 * @param {any} payload
 * @param {AuthUSer} currentUser
 */

export async function update(payload: any, id: number, currentUser?: AuthUser) {
  const isHr = currentUser && currentUser.isHr;
  const isAuthorized = currentUser && Number(currentUser.id) === Number(id);

  if (!isHr && !isAuthorized) {
    throw new BadRequest('Unauthorized', 'Not authorized for that action!', 200);
  }

  const user = withOnlyAttrs(payload, isHr ? usersUpdateFields : UPDATABLE_FIELDS);

  const designationAreas = payload.designationAreaHistory || [];
  const empStatusHistory = payload.empStatusHistory || [];
  const skills = payload.skills || [];

  const prevUser = await fetchById(Number(id), currentUser);

  if (!prevUser) {
    throw new BadRequest(`User does not not exist`, 'BadRequest', 400);
  }

  await genericModel.update(modelName, user, { id });

  if (isHr) {
    const employeeDesignationAreas = getDesignationAreaChangePromises(
      id,
      designationAreas,
      prevUser.designationAreaHistory,
      currentUser
    );

    const employeeStatusHistory = getEmployeeStatusChangePromises(
      id,
      empStatusHistory,
      prevUser.empStatusHistory,
      currentUser
    );

    const employeeSkills = getEmployeeSkillsChangePromises(id, skills, prevUser.skills, currentUser);

    await Promise.all([...employeeSkills, ...employeeDesignationAreas, ...employeeStatusHistory]);
  }

  const updatedUser = await fetchById(Number(id), currentUser);

  return updatedUser;
}

/**
 * Function that return promises of toCreate, toUpdate and toDelete of designationArea
 *
 * @param {number} id
 * @param {Skill[]} currentSkills
 * @param {Skill[]} previousSkills
 * @param {AuthUser} currentUser
 * @returns {Promises[]}
 */
function getEmployeeSkillsChangePromises(
  id: number,
  currentSkills: Skill[],
  previousSkills: Skill[],
  currentUser?: AuthUser
) {
  const { toRemove, toCreate } = extractCreateUpdateDelete(currentSkills, previousSkills);

  const createEmployeeSkills = toCreate.map(employeeSKill => {
    const employeeSkillObject: EmployeeSkill = {
      employeeSkillsId: id,
      skillId: employeeSKill.id
    };
    employeeSkillService.create(employeeSkillObject, currentUser);
  });

  const deleteEmployeeSkills = toRemove.map(employeeSKill =>
    employeeSkillService.remove({
      employeeSkillsId: id,
      skillId: employeeSKill.id
    })
  );

  return [...createEmployeeSkills, ...deleteEmployeeSkills];
}

/**
 * Function that return promises of toCreate, toUpdate and toDelete of designationArea
 *
 * @param {number} id
 * @param {EmployeeDesignationArea[]} currentEmployeeDesignationArea
 * @param {EmployeeDesignationArea[]} prevEmployeeDesignationArea
 * @param {AuthUser} currentUser
 * @returns {Promises[]}
 */
function getDesignationAreaChangePromises(
  id: number,
  currentEmployeeDesignationArea: EmployeeDesignationArea[],
  prevEmployeeDesignationArea: EmployeeDesignationArea[],
  currentUser?: AuthUser
) {
  const prevEmployeeDesignationAreas = mapDesignationAreaToModel(prevEmployeeDesignationArea, id);

  const employeeDesignationAreas = mapDesignationAreaToModel(currentEmployeeDesignationArea, id);

  const { toRemove, toCreate, toUpdate } = extractCreateUpdateDelete(
    employeeDesignationAreas,
    prevEmployeeDesignationAreas
  );

  const createEmployeeDesignationArea = toCreate.map(employeeDesignationArea =>
    employeeDesignationAreaService.create(employeeDesignationArea, currentUser)
  );

  const updateEmployeeDesignationArea = toUpdate.map(employeeDesignationArea =>
    employeeDesignationAreaService.update(employeeDesignationArea, employeeDesignationArea.id, currentUser)
  );

  const deleteEmployeeDesignationArea = toRemove.map(employeeDesignaitonArea =>
    employeeDesignationAreaService.remove(employeeDesignaitonArea.id)
  );

  return [...createEmployeeDesignationArea, ...updateEmployeeDesignationArea, ...deleteEmployeeDesignationArea];
}

/**
 * Function that return promises of toCreate, toUpdate and toDelete of employeeStatus
 *
 * @param {number} id
 * @param {EmployeeStatus[]} currentEmpStatusHistory
 * @param {EmployeeStatus[]} prevEmpStatusHistory
 * @param {AuthUser} currentUser
 * @returns {Promise[]}
 */
function getEmployeeStatusChangePromises(
  id: number,
  currentEmpStatusHistory: EmployeeStatus[],
  prevEmpStatusHistory: EmployeeStatus[],
  currentUser?: AuthUser
) {
  const prevEmpoyeeStatusHistory = mapEmployeeHistoryToModel(prevEmpStatusHistory, id);

  const currentEmployeeStatusHistory = mapEmployeeHistoryToModel(currentEmpStatusHistory, id);

  const { toRemove, toCreate, toUpdate } = extractCreateUpdateDelete(
    currentEmployeeStatusHistory,
    prevEmpoyeeStatusHistory
  );

  const createEmpStatusHistory = toCreate.map(employeeStatusHistory =>
    employeeStatusService.create(employeeStatusHistory, currentUser)
  );

  const updateEmpStatusHistory = toUpdate.map(employeeStatusHistory =>
    employeeStatusService.update(employeeStatusHistory.id, employeeStatusHistory, currentUser)
  );

  const deleteEmpStatusHistory = toRemove.map(employeeStatusHistory =>
    employeeStatusService.remove(employeeStatusHistory.id)
  );

  return [...createEmpStatusHistory, ...updateEmpStatusHistory, ...deleteEmpStatusHistory];
}

export async function uploadUserImage(file, fileName) {
  const { userPhotoBucket } = config.awsS3.bucket;

  const resizedImage = await resizeImage(file);
  if (!resizedImage) logger.error('Resized image not found');

  const pngImage = await convertToPNG(file);
  if (!pngImage) logger.error('PNG Image not found');

  const uploadAvatarImage = uploadToS3(userPhotoBucket, resizedImage, `avatar/${fileName}`);
  if (!uploadAvatarImage) logger.error('Upload resized image to S3 bucket failed!');

  const uploadOriginalImage = uploadToS3(userPhotoBucket, pngImage, `original/${fileName}`);
  if (!uploadOriginalImage) logger.error('Uploading original image to S3 bucked failed!');

  const [avatarUrl] = await Promise.all([uploadAvatarImage, uploadOriginalImage]);

  const newAvatarUrl = avatarUrl + '?' + uuidv4();

  return newAvatarUrl;
}

export async function updateAvatarUrl(userId, avatarUrl) {
  await genericModel.update(modelName, { avatarUrl }, { id: userId });
}

export async function checkDuplicateUser(where: Object) {
  return await genericModel.fetchByMultipleOrWhereClause<User>(modelName, where);
}

/**
 * Function that maps designationAreas from request body to required designationAreaHistory
 *
 * @param {EmployeeDesignationArea} designationAreas
 * @param {id} userId
 * @returns {EmployeeDesignationArea}
 */
function mapDesignationAreaToModel(designationAreas, userId) {
  return designationAreas.map(designationArea => {
    const employeeDesignationArea = {
      userId: userId,
      areaId: designationArea.area ? designationArea.area.id : null,
      designationId: designationArea.designation.id,
      transitionDate: designationArea.transitionDate
    };

    const id = designationArea.id;
    if (id) {
      employeeDesignationArea['id'] = id;
    }

    return employeeDesignationArea;
  });
}

/**
 * Function that maps empStatusHistory from request body to required employeeStatusHistory
 *
 * @param {EmployeeStatus} empStatusHistory
 * @param {id} userId
 * @returns {EmployeeStatus}
 */
function mapEmployeeHistoryToModel(empStatusHistory, userId) {
  return empStatusHistory.map(esh => {
    const employeeStatusHistory = {
      userId: userId,
      engagementStatusId: esh.engagementStatus.id,
      transitionDate: esh.transitionDate,
      endDate: esh.endDate ? esh.endDate : null
    };

    const id = esh.id;
    if (id) {
      employeeStatusHistory['id'] = id;
    }

    return employeeStatusHistory;
  });
}

/**
 *
 * @param {AuthUser} currentUser
 * @param {id} employeeId
 * @returns {boolean}
 */
function canViewEmployeeHistory(currentUser, employeeId) {
  return currentUser && (currentUser.isHr || currentUser.id === employeeId);
}

/**
 *
 * @param {AuthUser} currentUser
 * @param {id} employeeId
 * @returns {boolean}
 */
function canViewEmployeeCV(currentUser, employeeId) {
  return currentUser && (currentUser.isHr || currentUser.isPeopleOps || currentUser.id === employeeId);
}

/**
 * leaveIssuer and supervisor is same
 * Update user with new leaveIssuer id and then send email to employee and leaveIssuer
 *
 * @param {number} id
 * @param {LeaveIssuer} leaveIssuer
 */
export async function updateLeaveIssuer(id: number, leaveIssuer: LeaveIssuer) {
  const leaveIssuerId = leaveIssuer.id;
  const user = await fetchById(id);
  const newSupervisor = await fetchById(leaveIssuerId);

  const userEmail = user.email;
  const prevSupervisorEmail = user.supervisor.email;
  const supervisorEmail = newSupervisor.email;

  logger.info(`Service: updating leave issuer`);

  await genericModel.update(modelName, { supervisorId: leaveIssuerId }, { id: id });

  logger.info(`Service: leave issuer updated`);

  const employeeName = user.firstName + ' ' + user.lastName + '\'s';
  const supervisorName = newSupervisor.firstName + ' ' + newSupervisor.lastName;

  const employeeMessage = supervisorChangeMail(employeeName, supervisorName);

  logger.info(`Service: sending email`);

  sendMail([prevSupervisorEmail, userEmail, supervisorEmail], employeeName, employeeMessage);

  logger.info(`Service: email send to employee and leave issuer`);

  const data = await fetchById(id);

  return data;
}
