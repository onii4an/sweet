class UserSearchController < ApplicationController
  before_action :check_user
  helper_method :find_usr

  def usr_search; end

  def find_usr
    if !params[:name].empty? && !params[:surname].empty?
      @users = User.where(type: ['Boy', 'Girl']).search_name(params[:name]).search_surname(params[:surname]).all
    elsif !params[:name].empty?
      @users = User.where(type: ['Boy', 'Girl']).search_name(params[:name]).all
    elsif !params[:surname].empty?
      @user = User.where(type: ['Boy', 'Girl']).search_surname(params[:surname]).all
    else
      @users = User.where(type: ['Boy', 'Girl']).all
    end
  end

  private

  def check_user
    redirect_to root_path unless current_user || current_admin
  end
end
