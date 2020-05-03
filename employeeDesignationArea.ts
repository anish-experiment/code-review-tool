import * as userService from '../services/user';
import * as designationService from '../services/designation';
import * as designationAreaService from '../services/designationArea';

import * as employeeDesignationAreaModel from '../models/employeeDesignationArea';

import TokenError from '../errors/TokenError';
import DataNotFoundError from '../errors/DataNotFoundError';

import AuthUser from '../domains/common/AuthUser';
import EmployeeDesignationArea from '../domains/EmployeeDesignationArea';

import Knex = require('knex');

/**
 * Service to fetch all designationAreas.
 *
 * @returns {Promise<DesignationArea[]>}
 */
export async function fetchAll(): Promise<EmployeeDesignationArea[]> {
  const data = await employeeDesignationAreaModel.fetchAll();

  return data;
}

/**
 * Service to fetch employeeDesignationArea by id.
 *
 * @param {number} id
 * @returns {Promise<EmployeeDesignationArea>}
 */
export async function fetchById(id: number): Promise<EmployeeDesignationArea> {
  const data = await employeeDesignationAreaModel.fetchById(id);

  if (data.length === 0) {
    throw new DataNotFoundError('Employee designation area not found');
  }

  return data[0];
}

/**
 * Service to create employeeDesignationArea.
 *
 * @param {DesignationArea} designationArea
 * @param {currentUser} AuthUser
 */
export async function create(employeeDesignationArea: EmployeeDesignationArea, currentUser?: AuthUser) {
  if (!currentUser) {
    throw new TokenError('Token is inavlid or expired');
  }

  const { designation, employee } = await canCreateOrUpdate(employeeDesignationArea);

  if (designation && employee) {
    const employeeDesignationAreaData = await employeeDesignationAreaModel.create({
      ...employeeDesignationArea,
      updatedBy: currentUser.id,
      createdBy: currentUser.id
    });
    const data = fetchById(employeeDesignationAreaData[0]);
    return data;
  }
}

/**
 * Service to update employeeDesignationArea.
 *
 * @param {EmployeeDesignationArea} employeeDesignationArea
 * @param {id} number
 * @param {currentUser} AuthUser
 */
export async function update(
  employeeDesignationArea: EmployeeDesignationArea,
  id: number,
  currentUser?: AuthUser,
  tx?: Knex
) {
  if (!currentUser) {
    throw new TokenError('Token is inavlid or expired');
  }

  const { designation, employee } = await canCreateOrUpdate(employeeDesignationArea);

  if (designation && employee) {
    const updatedRowCount = await employeeDesignationAreaModel.update(
      { ...employeeDesignationArea, updatedBy: currentUser.id },
      id
    );
    if (Number(updatedRowCount) > 0) {
      const employeeDesignationArea = fetchById(id);
      return employeeDesignationArea;
    }
  }
}

/**
 * Service to remove employeeDesignationArea
 *
 * @param {id} number
 */
export async function remove(id: number): Promise<EmployeeDesignationArea> {
  const employeeDesignationArea: EmployeeDesignationArea = await fetchById(id);
  if (employeeDesignationArea) {
    await employeeDesignationAreaModel.remove(id);
  }
  return employeeDesignationArea;
}

/*
 * Function to check if Designation exist or not
 */
async function isDesignationExist(id: number) {
  await designationService.fetchById(id);
  return true;
}

/*
 * Function to check if DesignationArea exist or not
 */
async function isDesignationAreaExist(id: number) {
  await designationAreaService.fetchById(id);
  return true;
}

/*
 * Function to check if user/employee exist or not
 */
async function isEmployeeExist(id: number) {
  await userService.fetchById(id);
  return true;
}

/*
 * Function to check if designationArea can create or update
 */
async function canCreateOrUpdate(employeeDesignationArea: EmployeeDesignationArea) {
  const employee = await isEmployeeExist(Number(employeeDesignationArea.userId));
  const designation = await isDesignationExist(Number(employeeDesignationArea.designationId));
  if (Number(employeeDesignationArea.areaId !== null)) {
    await isDesignationAreaExist(Number(employeeDesignationArea.areaId));
  }
  return { designation, employee };
}
