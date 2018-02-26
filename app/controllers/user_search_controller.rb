class UserSearchController < ApplicationController
  before_action :check_user
  helper_method :find_usr

  def usr_search; end

  def find_usr
    if !params[:name].empty? && !params[:surname].empty?
      @users = User.where(name: params[:name], surname: params[:surname])
    elsif !params[:name].empty?
      @users = User.where(name: params[:name])
    elsif !params[:surname].empty?
      @users = User.where(surname: params[:surname])
    else
      @users = User.all
    end
  end

  private

  def check_user
    redirect_to root_path unless current_user || current_admin
  end
end
